"""Replace placeholder clinic contact info and working hours with the real
values now supplied by the client, and narrow the clinic's two daily
sessions to 10:00-14:00 and 16:30-20:00 (previously 09:00-13:00 and
16:00-20:00). Existing Appointment records are left untouched — only the
recurring DentistAvailability template and the ClinicSettings singleton are
updated.
"""

from datetime import time

from django.db import migrations

REAL_PHONE = "+91 88707 74432"
REAL_EMAIL = "drbelinroshia@gmail.com"
REAL_ADDRESS = (
    "23, SS Towers, Sarkar Samakulam Sathy Road, Kurumbapalayam, "
    "641107, Sarcarsamakulam, Tamil Nadu 641035"
)
REAL_MAPS_URL = "https://maps.app.goo.gl/1sA41VZLgnzXNse86"

NEW_HOURS = [
    (time(10, 0), time(14, 0)),
    (time(16, 30), time(20, 0)),
]


def update_clinic_info_and_hours(apps, schema_editor):
    ClinicSettings = apps.get_model("clinic", "ClinicSettings")
    Dentist = apps.get_model("clinic", "Dentist")
    DentistAvailability = apps.get_model("clinic", "DentistAvailability")

    settings_obj, _ = ClinicSettings.objects.get_or_create(pk=1)
    settings_obj.phone = REAL_PHONE
    settings_obj.email = REAL_EMAIL
    settings_obj.address = REAL_ADDRESS
    settings_obj.google_maps_url = REAL_MAPS_URL
    settings_obj.save()

    Dentist.objects.update(phone=REAL_PHONE)

    # Preserve whichever days are currently configured as working days;
    # only the hours within each of those days change.
    working_days = sorted(set(DentistAvailability.objects.values_list("day_of_week", flat=True)))
    DentistAvailability.objects.all().delete()
    for day in working_days:
        for start, end in NEW_HOURS:
            DentistAvailability.objects.create(
                day_of_week=day, start_time=start, end_time=end, is_active=True
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("clinic", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(update_clinic_info_and_hours, noop_reverse),
    ]
