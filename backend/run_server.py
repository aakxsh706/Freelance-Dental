"""Start the clinic server.

Used instead of the `waitress-serve` command because the self-contained
Windows build has no pip, and therefore none of the .exe shims pip normally
generates for a package's console scripts. Importing waitress and calling it
directly needs nothing but the package itself on sys.path.

Reads PORT and LISTEN from the environment so the launcher scripts stay the
single place those are set.
"""

import logging
import os
import sys
import threading
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Running under the embedded Python, sys.path comes from python312._pth and
# the script's own directory is NOT added (the path file implies isolated
# mode). Without this, `import config` fails with a bare ModuleNotFoundError.
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


def _poll_appointment_sheet_forever() -> None:
    """Runs for as long as the server is up, polling the booking sheet every
    APPOINTMENT_SHEET_POLL_INTERVAL_SECONDS (an env var in backend/.env,
    defaulting to 300 - see config.settings).

    A one-time poll already happens at startup (start-clinic.bat/.sh, right
    after `migrate`), so this loop covers "while the clinic has the software
    open" - a booking made mid-morning should not have to wait for the next
    restart to be picked up. Must never crash the server: any failure,
    including no internet (the ordinary case on a clinic machine), is logged
    and this loop simply waits for the next interval and tries again.

    Imports are local to this function because Django must already be set up
    (via the `from config.wsgi import application` import in main(), below)
    before clinic.appointment_sheet_poll can touch settings or the database -
    this function only ever runs as a thread started after that happens.
    """
    from django.conf import settings

    from clinic.appointment_sheet_poll import PollError, PollOffline, is_configured, poll

    if not is_configured():
        # Feature not set up on this machine - nothing to do, and no point
        # waking up every few minutes to find that out again.
        return

    interval = settings.APPOINTMENT_SHEET_POLL_INTERVAL_SECONDS
    logger = logging.getLogger(__name__)
    while True:
        time.sleep(interval)
        try:
            poll()
        except PollOffline as exc:
            logger.info("Appointment sheet poll: %s", exc)
        except PollError as exc:
            logger.warning("Appointment sheet poll failed: %s", exc)
        except Exception:  # noqa: BLE001 - must never take the server down
            logger.exception("Appointment sheet poll crashed unexpectedly.")


def main() -> int:
    port = int(os.environ.get("PORT", "8777"))
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

    # Daemon: it must never keep the process alive on its own, and closing
    # this window (which ends the process) is how staff stop the software -
    # the poll loop should not stand in the way of that.
    threading.Thread(target=_poll_appointment_sheet_forever, daemon=True).start()

    # threads: a single dentist and a receptionist, not a public website.
    serve(application, host=listen, port=port, threads=8)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
