"""Clear patient and appointment data, leaving the clinic's configuration.

For handing a populated development database over as a live system: the
clinic's own setup (staff logins, contact details, working hours, blocked
dates) is what someone spent time getting right and must survive, while the
patients and appointments accumulated during testing must not follow real
records into production.

Destructive and irreversible, so it refuses to run without --yes and prints
exactly what it is about to remove first.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from clinic.models import (
    Allergy,
    Appointment,
    AppointmentHistory,
    AppointmentNotification,
    AuditLog,
    ClinicalVisit,
    DentalHistory,
    FamilyMedicalHistory,
    Hospitalization,
    MedicalCondition,
    MedicalProfile,
    PastSurgery,
    Patient,
    PatientDocument,
    PatientMedication,
    Prescription,
    PrescriptionItem,
    Treatment,
)

# Order matters only for readability - the FKs cascade - but deleting
# appointments before patients is deliberate: Appointment.patient is SET_NULL,
# so removing patients first would orphan the appointments rather than remove
# them, leaving rows with a name and no record behind them.
PATIENT_DATA = [
    ("appointment notifications", AppointmentNotification),
    ("appointment history entries", AppointmentHistory),
    ("appointments", Appointment),
    ("prescription items", PrescriptionItem),
    ("prescriptions", Prescription),
    ("treatments", Treatment),
    ("documents", PatientDocument),
    ("clinical visits", ClinicalVisit),
    ("allergies", Allergy),
    ("medical conditions", MedicalCondition),
    ("medications", PatientMedication),
    ("past surgeries", PastSurgery),
    ("hospitalizations", Hospitalization),
    ("family history entries", FamilyMedicalHistory),
    ("medical profiles", MedicalProfile),
    ("dental histories", DentalHistory),
    ("patients", Patient),
]


class Command(BaseCommand):
    help = (
        "Delete all patient and appointment data. Clinic settings, working "
        "hours, blocked dates and staff logins are kept."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Actually delete. Without this the command only reports what it would remove.",
        )
        parser.add_argument(
            "--audit",
            action="store_true",
            help="Also clear the audit trail. Normally append-only; intended for setup cleanup only.",
        )

    def handle(self, *args, **options):
        counts = [(label, model.objects.count()) for label, model in PATIENT_DATA]
        audit_count = AuditLog.objects.count()

        self.stdout.write("Will remove:")
        for label, count in counts:
            if count:
                self.stdout.write(f"  {count:>6}  {label}")
        if options["audit"] and audit_count:
            self.stdout.write(f"  {audit_count:>6}  audit log entries")
        if not any(count for _, count in counts) and not (options["audit"] and audit_count):
            self.stdout.write(self.style.SUCCESS("Nothing to remove - already clean."))
            return

        self.stdout.write("")
        self.stdout.write("Will keep: staff logins, clinic settings, working hours, blocked dates.")
        if not options["audit"]:
            self.stdout.write("Will keep: the audit trail (pass --audit to clear it too).")
        self.stdout.write("")

        if not options["yes"]:
            self.stdout.write(
                self.style.WARNING("Dry run - nothing deleted. Re-run with --yes to proceed.")
            )
            return

        with transaction.atomic():
            for label, model in PATIENT_DATA:
                model.objects.all().delete()
            if options["audit"]:
                AuditLog.objects.all().delete()

        self.stdout.write(self.style.SUCCESS("Clinic data cleared."))
        self.stdout.write(
            "Patient numbering restarts at BEL-000001, since codes are allocated "
            "from the highest one in use."
        )
