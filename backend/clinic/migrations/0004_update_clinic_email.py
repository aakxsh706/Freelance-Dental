"""Update the clinic's public email to its final address, replacing the
earlier drbelinroshia@gmail.com. Phone, address, name, and working hours are
untouched.
"""

from django.db import migrations

NEW_EMAIL = "belindentistry@gmail.com"


def update_clinic_email(apps, schema_editor):
    ClinicSettings = apps.get_model("clinic", "ClinicSettings")
    settings_obj, _ = ClinicSettings.objects.get_or_create(pk=1)
    settings_obj.email = NEW_EMAIL
    settings_obj.save()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("clinic", "0003_rename_clinic_and_new_address"),
    ]

    operations = [
        migrations.RunPython(update_clinic_email, noop_reverse),
    ]
