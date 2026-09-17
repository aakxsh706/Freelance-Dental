from django.conf import settings
from django.db import models

from .base import TimeStampedModel
from .scheduling import Appointment


class AppointmentHistory(models.Model):
    """The timeline shown against an appointment: what changed, when, by whom.

    Distinct from AuditLog on purpose, and not a duplicate of it:

      * AuditLog is the compliance trail across every model - "who opened or
        changed this record", with IP and user agent. It is generic, its diff
        is loose JSON, and staff never read it during a normal day.
      * AppointmentHistory is a product feature. It is rendered on the
        appointment and on the patient's file, so it needs typed columns -
        a reschedule has to show "20 Sep 10:30 -> 21 Sep 11:30" without
        anything having to parse JSON to render it.

    Both are written from one place (clinic/appointment_events.py) so the two
    can never tell different stories about the same event.
    """

    class Event(models.TextChoices):
        CREATED = "created", "Created"
        CONFIRMED = "confirmed", "Confirmed"
        RESCHEDULED = "rescheduled", "Rescheduled"
        EDITED = "edited", "Edited"
        CHECKED_IN = "checked_in", "Checked in"
        ARRIVAL_CORRECTED = "arrival_corrected", "Arrival time corrected"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"
        NO_SHOW = "no_show", "Marked no-show"
        SLOT_OVERRIDE = "slot_override", "Slot conflict overridden"

    appointment = models.ForeignKey(
        Appointment, on_delete=models.CASCADE, related_name="history"
    )
    event_type = models.CharField(max_length=30, choices=Event.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="appointment_changes",
    )
    changed_by_name = models.CharField(
        max_length=150,
        blank=True,
        help_text="Captured at write time so the timeline survives the user being deleted.",
    )

    # Nullable throughout: a confirmation changes status but not the date, and
    # a reschedule changes the date but not the status. Only what actually
    # moved is recorded, so the UI can render exactly what happened.
    old_date = models.DateField(null=True, blank=True)
    old_time = models.TimeField(null=True, blank=True)
    new_date = models.DateField(null=True, blank=True)
    new_time = models.TimeField(null=True, blank=True)
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)

    reason = models.CharField(max_length=255, blank=True)
    # Free-form extras for events that carry something beyond the typed
    # columns, such as which appointment a slot override collided with.
    detail = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name_plural = "Appointment history"
        indexes = [models.Index(fields=["appointment", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.get_event_type_display()} - {self.appointment_id}"

    @property
    def schedule_changed(self) -> bool:
        return bool(self.old_date or self.old_time) and (
            self.old_date != self.new_date or self.old_time != self.new_time
        )


class AppointmentNotification(TimeStampedModel):
    """One row per email the clinic owes a patient about an appointment.

    A row is created inside the same transaction as the change that triggered
    it, in `pending`, and only then is delivery attempted. That ordering is the
    point: if the process dies mid-send, the record of what was owed survives,
    and a `pending` or `failed` row can be retried. A boolean flag on
    Appointment could not express "we tried and SMTP refused it".

    `dedupe_key` makes sending idempotent. Confirming twice must not email the
    patient twice, but two genuinely different reschedules must both send - so
    the key is per-event, not per-type.
    """

    class Type(models.TextChoices):
        BOOKING_RECEIVED = "booking_received", "Booking received"
        CONFIRMATION = "confirmation", "Confirmation"
        RESCHEDULE = "reschedule", "Reschedule"
        CANCELLATION = "cancellation", "Cancellation"
        REMINDER = "reminder", "Reminder"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    appointment = models.ForeignKey(
        Appointment, on_delete=models.CASCADE, related_name="notifications"
    )
    notification_type = models.CharField(max_length=30, choices=Type.choices)
    recipient_email = models.EmailField(blank=True)
    subject = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.CharField(max_length=500, blank=True)
    attempts = models.PositiveIntegerField(default=0)

    dedupe_key = models.CharField(
        max_length=100,
        help_text="Unique per appointment; repeat sends for the same event collapse onto one row.",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["appointment", "dedupe_key"],
                name="unique_appointment_notification_event",
            )
        ]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.get_notification_type_display()} -> {self.recipient_email} ({self.status})"

    @property
    def was_delivered(self) -> bool:
        return self.status == self.Status.SENT
