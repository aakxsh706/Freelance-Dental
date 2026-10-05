"""Push patient contact details to the clinic's Google Sheet.

Safe to run on a timer, on reconnect, or by hand, in any order and any number
of times - see clinic/sheet_sync.py for why.

Being offline is not an error: the command says so and exits 0, so a cron
entry or a reconnect hook on an offline clinic machine does not fill the logs
with failures for the ordinary case of having no internet.
"""

from django.core.management.base import BaseCommand

from clinic.sheet_sync import (
    COLUMNS,
    SheetOffline,
    SheetSyncError,
    desired_rows,
    is_configured,
    sync,
)


class Command(BaseCommand):
    help = "Send patient contact details to the configured Google Sheet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be sent without contacting Google. Works offline.",
        )
        parser.add_argument(
            "--show",
            type=int,
            default=0,
            metavar="N",
            help="With --dry-run, print the first N rows.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if not is_configured() and not dry_run:
            raise SystemExit(
                self.style.ERROR(
                    "Patient sheet sync is not configured.\n"
                    "Set these in backend/.env:\n"
                    "  PATIENT_SHEET_WEBHOOK_URL=<the Apps Script Web app URL>\n"
                    "  PATIENT_SHEET_WEBHOOK_TOKEN=<must match TOKEN in the script>\n"
                    "The script is in docs/patient_sheet_webhook.gs; see README.md."
                )
            )

        if dry_run:
            rows = desired_rows()
            noun = "patient" if len(rows) == 1 else "patients"
            self.stdout.write(f"Would send {len(rows)} {noun}. Columns:")
            self.stdout.write("  " + " | ".join(COLUMNS))
            for row in rows[: options["show"]]:
                self.stdout.write("  " + " | ".join(row))
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING("Dry run - Google was not contacted, nothing was sent.")
            )
            return

        try:
            result = sync()
        except SheetOffline as exc:
            # Routine on a clinic machine. Exit 0 so a scheduled run is not
            # reported as a failure for being offline.
            self.stdout.write(self.style.WARNING(str(exc)))
            return
        except SheetSyncError as exc:
            raise SystemExit(self.style.ERROR(str(exc)))

        if result.wrote_anything:
            self.stdout.write(self.style.SUCCESS(f"Sheet updated - {result.summary()}."))
        else:
            self.stdout.write(f"Sheet already up to date - {result.summary()}.")
