"""Show the clinic's real location in the website map, replacing the
placeholder. Only fills an empty value, so a map already set from the clinic
settings page is left alone.
"""

from django.db import migrations, models


def fill_map_embed(apps, schema_editor):
    ClinicSettings = apps.get_model("clinic", "ClinicSettings")
    default = ClinicSettings._meta.get_field("google_maps_embed_url").default
    ClinicSettings.objects.filter(google_maps_embed_url="").update(
        google_maps_embed_url=default
    )


class Migration(migrations.Migration):

    dependencies = [
        ('clinic', '0012_alter_clinicsettings_email'),
    ]

    operations = [
        migrations.AlterField(
            model_name='clinicsettings',
            name='google_maps_embed_url',
            field=models.URLField(blank=True, default='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d500!2d77.0214229!3d11.1014248!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba8f94e0565a521%3A0x4741f01b6c83c8b3!2sDr.%20Belin%27s%20Dentistry!5e0!3m2!1sen!2sin!4v1759150000000!5m2!1sen!2sin', help_text='Google Maps embed URL (src of an <iframe>), from Share > Embed a map.', max_length=500),
        ),
        migrations.RunPython(fill_map_embed, migrations.RunPython.noop),
    ]
