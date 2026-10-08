"""Pull new appointment-sheet rows from Google and import them.

Run automatically once at clinic startup (start-clinic.bat / start-clinic.sh,
right after `migrate`) and again every few minutes for as long as the server
keeps running (the background loop in backend/run_server.py). This command is
also how to run it by hand - e.g. right after setting up the Apps Script
deployment, to check it actually works.

Safe to run on a timer, at startup, or by hand, any number of times: rows
already imported are reported as duplicates rather than re-created, because
Appointment.external_reference is the idempotency key.

Never exits non-zero. The feature being unconfigured, the machine being
offline, and the sheet's script rejecting a stale token are all routine
conditions on a clinic PC that must never stop start-clinic.bat/.sh from
continuing on to launch the server - the same reasoning
backend/update_check.py explains for itself. Each case still prints a clear,
styled message so a staff member (or whoever is setting this up) running the
command by hand can see what happened.
"""

from django.core.management.base import BaseCommand

from clinic.appointment_sheet_poll import PollError, PollOffline, is_configured, poll


class Command(BaseCommand):
    help = "Pull new booking rows from the configured Google Sheet and import them."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Confirm the poll is configured without contacting Google. Works offline.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if not is_configured():
            self.stdout.write(
                self.style.WARNING(
                    "Appointment sheet poll is not configured - set "
                    "APPOINTMENT_SHEET_POLL_URL and APPOINTMENT_SHEET_TOKEN in "
                    "backend/.env.\n"
                    "The script is in docs/appointment_sheet_poll.gs; see "
                    "README.md."
                )
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "Appointment sheet poll is configured. "
                    "Dry run - Google was not contacted, nothing was imported."
                )
            )
            return

        try:
            result = poll()
        except PollOffline as exc:
            # Routine on a clinic machine - see the module docstring.
            self.stdout.write(self.style.WARNING(str(exc)))
            return
        except PollError as exc:
            # A real problem (bad token, bad URL, broken script) - but still
            # must not stop the clinic opening, so this is reported, not
            # raised.
            self.stdout.write(self.style.ERROR(str(exc)))
            return

        if result.error:
            self.stdout.write(self.style.WARNING(f"Poll complete - {result.summary()}."))
            for item in result.errors:
                self.stdout.write(
                    self.style.ERROR(f"  Row {item.get('row_id')}: {item.get('detail')}")
                )
        elif result.created:
            self.stdout.write(self.style.SUCCESS(f"Poll complete - {result.summary()}."))
        else:
            self.stdout.write(f"Poll complete - {result.summary()}.")
