"""Create backend/.env on a fresh machine.

Run by the build scripts. A clinic PC is set up by whoever is standing in
front of it, not by a developer, and the two settings that stop the software
booting - DEBUG and SECRET_KEY - are exactly the two nobody would think to
change. So they are filled in here rather than left as an instruction someone
has to read and act on.

Never overwrites an existing .env: on a machine that is already configured,
rebuilding must not wipe the clinic's email credentials or sheet token.
"""

import secrets
import string
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
ENV = BASE / ".env"
EXAMPLE = BASE / ".env.example"


def generate_secret_key() -> str:
    """Django's own recipe, without needing Django importable yet."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*(-_=+)"
    return "".join(secrets.choice(alphabet) for _ in range(64))


def main() -> int:
    if ENV.exists():
        print(".env already exists - left untouched.")
        return 0

    if not EXAMPLE.exists():
        print("ERROR: .env.example is missing; cannot create .env.", file=sys.stderr)
        return 1

    lines = EXAMPLE.read_text(encoding="utf-8").splitlines()
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("SECRET_KEY="):
            out.append(f"SECRET_KEY={generate_secret_key()}")
        elif stripped.startswith("DEBUG="):
            # A clinic install is a production install. DEBUG=True would serve
            # tracebacks containing patient data to anyone who triggers an error.
            out.append("DEBUG=False")
        else:
            out.append(line)

    # An on-premise clinic PC serves plain http://localhost with no TLS
    # certificate. Django's production defaults assume an internet-facing
    # server behind HTTPS, and applied here they make the software
    # unreachable: the redirect sends the browser to https://, nothing is
    # listening there, and HSTS then makes the browser keep doing it for a
    # year even after the setting is changed back.
    out += [
        "",
        "# --- On-premise clinic PC -------------------------------------------------",
        "# This machine serves plain HTTP on localhost with no certificate, so",
        "# Django's HTTPS enforcement has to be off or nothing can reach it.",
        "# If this clinic is ever put behind a real domain with TLS, delete these",
        "# five lines - the secure defaults come back on their own.",
        "SECURE_SSL_REDIRECT=False",
        "SECURE_HSTS_SECONDS=0",
        "SECURE_HSTS_PRELOAD=False",
        "SESSION_COOKIE_SECURE=False",
        "CSRF_COOKIE_SECURE=False",
    ]

    ENV.write_text("\n".join(out) + "\n", encoding="utf-8")
    print("Created backend/.env with a freshly generated SECRET_KEY and DEBUG=False.")
    print("Email and Google Sheet settings are blank - fill them in when needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
