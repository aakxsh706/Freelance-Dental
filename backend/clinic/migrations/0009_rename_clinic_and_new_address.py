"""Rename the clinic brand from "Belin's Dental Clinic" to "Dr. Belin's
Dentistry" and correct the clinic address to resolve the earlier PIN-code
discrepancy (641107 vs 641035) using the client-supplied address, which
carries only 641107. Phone, email, working hours, and the Google Maps link
are untouched.
"""

from django.db import migrations

NEW_CLINIC_NAME = "Dr. Belin's Dentistry"
NEW_ADDRESS = (
    "No. 23, SS Towers, Kurumbapalayam, Sathy road, "
    "Sarkarsamakulam PO, Coimbatore 641107, Tamilnadu"
)


def update_clinic_name_and_address(apps, schema_editor):
    ClinicSettings = apps.get_model("clinic", "ClinicSettings")
    settings_obj, _ = ClinicSettings.objects.get_or_create(pk=1)
    settings_obj.clinic_name = NEW_CLINIC_NAME
    settings_obj.address = NEW_ADDRESS
    settings_obj.save()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("clinic", "0008_real_clinic_info_and_hours"),
    ]

    operations = [
        migrations.RunPython(update_clinic_name_and_address, noop_reverse),
    ]
