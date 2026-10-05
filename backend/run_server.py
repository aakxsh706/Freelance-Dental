"""Start the clinic server.

Used instead of the `waitress-serve` command because the self-contained
Windows build has no pip, and therefore none of the .exe shims pip normally
generates for a package's console scripts. Importing waitress and calling it
directly needs nothing but the package itself on sys.path.

Reads PORT and LISTEN from the environment so the launcher scripts stay the
single place those are set.
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Running under the embedded Python, sys.path comes from python312._pth and
# the script's own directory is NOT added (the path file implies isolated
# mode). Without this, `import config` fails with a bare ModuleNotFoundError.
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


def main() -> int:
    port = int(os.environ.get("PORT", "8000"))
    # This machine only by default. Patient records should not be reachable
    # from the rest of the clinic network unless that is asked for.
    listen = os.environ.get("LISTEN", "127.0.0.1")

    try:
        from waitress import serve
    except ImportError:
        print(
            "ERROR: waitress is not available.\n"
            "The installation looks incomplete - run install-clinic.bat again.",
            file=sys.stderr,
        )
        return 1

    from config.wsgi import application

    print()
    print("  Dr. Belin's Dentistry")
    print()
    print(f"    Clinic software:  http://localhost:{port}")
    print(f"    Staff login:      http://localhost:{port}/clinic/login")
    print()
    print("    Keep this window open. Close it to stop the software.")
    print()

    # threads: a single dentist and a receptionist, not a public website.
    serve(application, host=listen, port=port, threads=8)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
