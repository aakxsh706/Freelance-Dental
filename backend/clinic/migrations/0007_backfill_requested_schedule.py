"""Seed requested_date/requested_time for appointments that predate the fields.

For rows already in the database, the only honest answer to "what was
originally requested" is the schedule they currently hold: any earlier value
was overwritten before these columns existed and cannot be recovered. That is
also the correct answer for the large majority, which were never moved.

Appointments whose history records a reschedule are the exception - there the
first recorded `old_date`/`old_time` *is* the original request, so it is used.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Appointment = apps.get_model("clinic", "Appointment")
    AppointmentHistory = apps.get_model("clinic", "AppointmentHistory")

    # Earliest recorded reschedule per appointment carries the original time.
    originals = {}
    for entry in AppointmentHistory.objects.filter(
        event_type="rescheduled", old_date__isnull=False
    ).order_by("created_at", "id"):
        originals.setdefault(entry.appointment_id, (entry.old_date, entry.old_time))

    updated = 0
    for appointment in Appointment.objects.filter(requested_date__isnull=True).iterator():
        original = originals.get(appointment.id)
        Appointment.objects.filter(pk=appointment.pk).update(
            requested_date=original[0] if original else appointment.appointment_date,
            requested_time=original[1] if original else appointment.appointment_time,
        )
        updated += 1
    if updated:
        print(f"    backfilled requested schedule for {updated} appointment(s)")


def unbackfill(apps, schema_editor):
    Appointment = apps.get_model("clinic", "Appointment")
    Appointment.objects.update(requested_date=None, requested_time=None)


class Migration(migrations.Migration):
    dependencies = [("clinic", "0006_appointment_requested_date_and_more")]
    operations = [migrations.RunPython(backfill, unbackfill)]
