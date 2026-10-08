"""Check GitHub for a newer release and install it, before the clinic opens.

Run by start-clinic.bat / start-clinic.sh, with the embedded/local Python,
before `manage.py migrate` and before the server starts. There is no running
server to stop or restart around this - it all happens before launch.

Mirrors the offline philosophy already established in clinic/sheet_sync.py:
a clinic PC may go days without a connection, and that is the ordinary case,
not a fault. Any network problem here - no internet, DNS down, a timeout, a
404 because nothing has been released yet - is handled quietly and this
script always exits 0. It must never block or fail clinic startup.

Update flow, only once a newer release is actually found:
  1. Download the release's .zip asset to a temp file.
  2. Extract it to a temp staging directory.
  3. Sanity-check the staging directory contains backend/ and frontend/dist/
     before touching anything live.
  4. Copy backend/ source files over the live install, skipping .env,
     db.sqlite3, media/, venv/ and anything under __pycache__ - those are
     either patient data, local secrets, or this machine's own install
     artifacts, and must survive every update untouched. runtime/ (the
     unpacked embedded Python, created by install-clinic.bat) lives outside
     backend/ entirely and is never visited by this script at all.
  5. Replace frontend/dist/ wholesale - it holds nothing but a static build,
     so a full replace (rather than a careful merge) is safe and avoids
     accumulating stale hashed asset files from old builds.
  6. Record the new version in the local VERSION file.

Any new database migrations that came with the release are handled for
free: start-clinic.bat runs `manage.py migrate --noinput` immediately after
this script, before launching the server. This script does not duplicate
that.
"""

from __future__ import annotations

import json
import re
import shutil
import socket
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

GITHUB_API_URL = (
    "https://api.github.com/repos/belindentistry-gittt/Clinic-Portal/releases/latest"
)
USER_AGENT = "belin-clinic-update-check/1.0"
API_TIMEOUT_SECONDS = 8
DOWNLOAD_TIMEOUT_SECONDS = 60

# backend/update_check.py -> backend/ -> repo root.
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
VERSION_FILE = ROOT_DIR / "VERSION"
FRONTEND_DIST_DIR = ROOT_DIR / "frontend" / "dist"

# Top-level names under backend/ that must never be overwritten by a release.
# .env and db.sqlite3 are files; media and venv are directories.
EXCLUDED_BACKEND_TOP_LEVEL = {".env", "db.sqlite3", "media", "venv"}


def strip_leading_v(tag: str) -> str:
    tag = tag.strip()
    if tag[:1] in ("v", "V"):
        return tag[1:]
    return tag


def parse_version(version: str) -> tuple[int, ...]:
    """"v1.2.0" / "1.2.0" -> (1, 2, 0). Non-numeric suffixes are ignored, so
    this never raises on an odd tag - it just compares what it can."""
    cleaned = strip_leading_v(version)
    numbers = []
    for part in cleaned.split("."):
        match = re.match(r"\d+", part)
        numbers.append(int(match.group()) if match else 0)
    return tuple(numbers) if numbers else (0,)


def read_local_version() -> str:
    try:
        text = VERSION_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0"
    return text or "0.0.0"


def write_local_version(tag: str) -> None:
    VERSION_FILE.write_text(strip_leading_v(tag) + "\n", encoding="utf-8")


def fetch_latest_release() -> dict | None:
    """The latest release's JSON, or None if it isn't reachable - in which
    case a clear status line has already been printed."""
    request = urllib.request.Request(
        GITHUB_API_URL,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/vnd.github+json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=API_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            print("No published updates yet - running the installed version.")
        else:
            print(f"Update check skipped (GitHub returned HTTP {exc.code}).")
        return None
    except (urllib.error.URLError, socket.timeout, TimeoutError, OSError):
        # The ordinary offline case on a clinic machine.
        print("No internet connection right now - skipping the update check.")
        return None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print("Update check skipped (GitHub sent something unreadable).")
        return None

    if not isinstance(data, dict):
        print("Update check skipped (unexpected response from GitHub).")
        return None
    return data


def find_zip_asset(release: dict) -> tuple[str, str] | tuple[None, None]:
    for asset in release.get("assets") or []:
        name = asset.get("name") or ""
        url = asset.get("browser_download_url")
        if url and name.lower().endswith(".zip"):
            return name, url
    return None, None


def download(url: str, destination: Path) -> bool:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(
            request, timeout=DOWNLOAD_TIMEOUT_SECONDS
        ) as response, open(destination, "wb") as out_file:
            shutil.copyfileobj(response, out_file)
        return True
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        socket.timeout,
        TimeoutError,
        OSError,
    ) as exc:
        print(f"Could not download the update ({exc}) - will try again next time.")
        return False


def locate_release_root(staging: Path) -> Path | None:
    """Where backend/ and frontend/dist/ live inside the extracted zip.

    Normally that is the staging directory itself. Tolerates one extra
    wrapping folder too (e.g. the "reponame-tag/" layout a GitHub-generated
    source archive would have), in case a release is ever published that way
    instead of via package-release.bat's flatter layout.
    """
    candidates = [staging, *[p for p in staging.iterdir() if p.is_dir()]]
    for candidate in candidates:
        if (candidate / "backend").is_dir() and (candidate / "frontend" / "dist").is_dir():
            return candidate
    return None


def is_excluded_backend_path(relative_path: Path) -> bool:
    if relative_path.parts and relative_path.parts[0] in EXCLUDED_BACKEND_TOP_LEVEL:
        return True
    if "__pycache__" in relative_path.parts:
        return True
    if relative_path.suffix == ".pyc":
        return True
    return False


def copy_backend_source(source_backend: Path, dest_backend: Path) -> None:
    """Overwrite backend source files in place. Patient data (db.sqlite3,
    media/), local secrets (.env) and this machine's own virtualenv (venv/)
    are skipped by is_excluded_backend_path and so are never touched, no
    matter what the downloaded release happens to contain."""
    for source_file in source_backend.rglob("*"):
        if not source_file.is_file():
            continue
        relative = source_file.relative_to(source_backend)
        if is_excluded_backend_path(relative):
            continue
        dest_file = dest_backend / relative
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, dest_file)


def replace_frontend_dist(source_dist: Path, dest_dist: Path) -> None:
    """frontend/dist/ holds nothing but a static build - safe to replace
    wholesale rather than merge, which also clears out old hashed assets
    from a previous build that a merge would otherwise leave behind."""
    if dest_dist.exists():
        shutil.rmtree(dest_dist)
    shutil.copytree(source_dist, dest_dist)


def main() -> int:
    print("Checking for updates...")
    release = fetch_latest_release()
    if release is None:
        return 0

    tag = release.get("tag_name")
    if not tag:
        print("Update check skipped (the latest release has no version tag).")
        return 0

    asset_name, asset_url = find_zip_asset(release)
    if not asset_url:
        print(f"Release {tag} has no downloadable package - skipping.")
        return 0

    local_version = read_local_version()
    if parse_version(tag) <= parse_version(local_version):
        print(f"Already up to date (version {local_version}).")
        return 0

    new_version = strip_leading_v(tag)
    print(f"Updating to version {new_version}...")

    tmp_dir = Path(tempfile.mkdtemp(prefix="belin-update-"))
    try:
        zip_path = tmp_dir / (asset_name or "update.zip")
        if not download(asset_url, zip_path):
            return 0

        staging = tmp_dir / "staging"
        staging.mkdir()
        try:
            with zipfile.ZipFile(zip_path) as archive:
                archive.extractall(staging)
        except zipfile.BadZipFile:
            print("The downloaded update looks corrupted - skipping this time.")
            return 0

        release_root = locate_release_root(staging)
        if release_root is None:
            print("The downloaded update is missing expected files - skipping.")
            return 0

        copy_backend_source(release_root / "backend", BACKEND_DIR)
        replace_frontend_dist(release_root / "frontend" / "dist", FRONTEND_DIST_DIR)

        write_local_version(tag)
        print(f"Update installed. Now on version {new_version}. Starting...")
        return 0
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - never block clinic startup
        print(f"Update check skipped due to an unexpected error: {exc}")
        raise SystemExit(0)
