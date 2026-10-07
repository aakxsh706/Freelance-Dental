"""Give appointments that predate the timeline feature a first entry.

Without this, every appointment already in the database shows an empty
history, which reads as "nothing ever happened to this" rather than "this
was created before we started recording". One honest `created` event per
existing appointment, stamped with the row's real creation time and flagged
as backfilled so nobody mistakes it for a recorded observation.

Nothing is invented beyond that: the confirmation and reschedule events that
were never captured cannot be reconstructed, so they are not guessed at.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Appointment = apps.get_model("clinic", "Appointment")
    AppointmentHistory = apps.get_model("clinic", "AppointmentHistory")

    existing = set(
        AppointmentHistory.objects.values_list("appointment_id", flat=True)
    )
    rows = []
    for appointment in Appointment.objects.exclude(id__in=existing).iterator():
        rows.append(
            AppointmentHistory(
                appointment_id=appointment.id,
                event_type="created",
                changed_by_name="",
                new_status=appointment.status,
                detail={"source": appointment.source, "backfilled": True},
            )
        )
    if not rows:
        return
    AppointmentHistory.objects.bulk_create(rows, batch_size=500)

    # created_at is auto_now_add, so it cannot be set on the way in. Align each
    # backfilled entry with the appointment it describes, or the timeline
    # claims every historical appointment was created during this deploy.
    for entry in AppointmentHistory.objects.filter(
        event_type="created", detail__backfilled=True
    ).select_related("appointment"):
        AppointmentHistory.objects.filter(pk=entry.pk).update(
            created_at=entry.appointment.created_at
        )


def unbackfill(apps, schema_editor):
    AppointmentHistory = apps.get_model("clinic", "AppointmentHistory")
    AppointmentHistory.objects.filter(
        event_type="created", detail__backfilled=True
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("clinic", "0004_appointmenthistory_appointmentnotification_and_more"),
    ]

    operations = [migrations.RunPython(backfill, unbackfill)]
