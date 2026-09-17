import os
from datetime import time

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from clinic.models import ClinicSettings, Dentist, DentistAvailability, StaffProfile

DEFAULT_HOURS = [
    (time(10, 0), time(14, 0)),
    (time(16, 30), time(20, 0)),
]
# Monday(0) - Saturday(5) open with the default split shift; Sunday(6) closed.
DEFAULT_WORKING_DAYS = range(0, 6)


class Command(BaseCommand):
    help = (
        "Seed the dentist login and staff role, default clinic settings, and "
        "default working hours. Safe to re-run; existing data is left untouched."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        username = os.environ.get("DENTIST_USERNAME", "drbelin")
        email = os.environ.get("DENTIST_EMAIL", "dentist@belinsdental.example")
        password = os.environ.get("DENTIST_PASSWORD")

        user, created = User.objects.get_or_create(
            username=username, defaults={"email": email}
        )
        if created:
            if not password:
                password = User.objects.make_random_password()
                self.stdout.write(
                    self.style.WARNING(
                        "DENTIST_PASSWORD was not set - generated a random password "
                        f"for '{username}': {password}\n"
                        "Set DENTIST_PASSWORD in backend/.env and re-seed to control it yourself."
                    )
                )
            user.set_password(password)
            user.is_staff = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created dentist login user '{username}'."))
        else:
            self.stdout.write(f"Dentist login user '{username}' already exists - left as-is.")

        dentist, dentist_created = Dentist.objects.get_or_create(
            user=user,
            defaults={
                "name": "Dr. Belin [Placeholder]",
                "title": "Dentist & Oral Healthcare Professional",
                "email": email,
                "phone": "+91 88707 74432",
                "bio": (
                    "Dr. Belin focuses on patient comfort, preventive care, and "
                    "clear communication — helping every patient understand their "
                    "treatment options and make confident decisions about their "
                    "oral health for the long term."
                ),
                "profile_image": "",
            },
        )
        if dentist_created:
            self.stdout.write(self.style.SUCCESS("Created dentist profile."))

        # The clinic software authorises by role, so the dentist needs a staff
        # profile as well as a Dentist record - without it they could sign in
        # but reach none of the internal screens.
        staff, staff_created = StaffProfile.objects.get_or_create(
            user=user,
            defaults={
                "full_name": dentist.name,
                "role": StaffProfile.Role.DENTIST,
                "phone": dentist.phone,
                "is_active": True,
            },
        )
        if staff_created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created staff profile for '{username}' with the dentist role "
                    "(full access, including clinical records and the audit trail)."
                )
            )
        else:
            self.stdout.write(
                f"Staff profile for '{username}' already exists "
                f"(role: {staff.get_role_display()}) - left as-is."
            )

        settings_obj = ClinicSettings.load()
        if settings_obj.address.startswith("Clinic Address"):
            self.stdout.write(
                "Clinic settings are using placeholder values - replace them in "
                "the Django admin once real details are available."
            )

        if not DentistAvailability.objects.exists():
            for day in DEFAULT_WORKING_DAYS:
                for start, end in DEFAULT_HOURS:
                    DentistAvailability.objects.create(
                        day_of_week=day, start_time=start, end_time=end, is_active=True
                    )
            self.stdout.write(
                self.style.SUCCESS(
                    "Created default working hours: Mon-Sat, 10:00-14:00 and 16:30-20:00 "
                    "(adjust from the dentist dashboard or admin if this changes)."
                )
            )
        else:
            self.stdout.write("Working hours already configured - left as-is.")

        self.stdout.write(self.style.SUCCESS("Seed complete."))
        self.stdout.write(
            "Additional staff (assistants, reception) are added in the Django "
            "admin: create the user, then give them a Staff profile with the "
            "appropriate role."
        )
