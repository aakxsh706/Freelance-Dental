from django.conf import settings
from django.db import models

from .patients import Patient

# Statuses that no longer hold a slot. A cancelled or no-show appointment frees
# its time for someone else; everything else still occupies it.
#
# Module level because a nested `class Meta` cannot see names defined in the
# enclosing class body, and the database constraint below has to be built from
# exactly the same list that availability.py filters on.
SLOT_RELEASING_STATUSES = ("cancelled", "no_show")

# Statuses meaning "still going to happen". Distinct from the list above on
# purpose: a completed appointment occupied its slot (so it is not
# slot-releasing) but is finished business and must not be offered as
# upcoming. Conflating the two puts finished visits in tomorrow's list.
OPEN_STATUSES = ("pending", "confirmed", "checked_in")


class Appointment(models.Model):
    """A scheduled slot.

    Deliberately still carries `patient_name` / `phone` / `email` alongside the
    `patient` FK. Those are a snapshot of what the person typed at booking
    time: editing a patient's phone number years later must not rewrite the
    contact details attached to a historical appointment, and the columns keep
    pre-Patient rows readable.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        CHECKED_IN = "checked_in", "Checked In"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No Show"

    class Source(models.TextChoices):
        WEBSITE = "website", "Website"
        CLINIC = "clinic", "Clinic"
        PHONE = "phone", "Phone"
        WALK_IN = "walk_in", "Walk-in"
        OTHER = "other", "Other"

    class MatchStatus(models.TextChoices):
        LINKED = "linked", "Linked to existing patient"
        CREATED = "created", "New patient created"
        AMBIGUOUS = "ambiguous", "Needs staff review"
        UNMATCHED = "unmatched", "Not linked"

    # Re-exported on the model so call sites can use Appointment.SLOT_RELEASING_STATUSES.
    SLOT_RELEASING_STATUSES = SLOT_RELEASING_STATUSES
    OPEN_STATUSES = OPEN_STATUSES

    patient = models.ForeignKey(
        Patient,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="appointments",
    )

    patient_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    reason = models.CharField(max_length=255)
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.WEBSITE
    )

    match_status = models.CharField(
        max_length=20, choices=MatchStatus.choices, default=MatchStatus.UNMATCHED
    )
    match_candidates = models.JSONField(
        default=list,
        blank=True,
        help_text="Patient ids a website booking could plausibly belong to, when more than one matched.",
    )

    checked_in_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=255, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_appointments",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["appointment_date", "appointment_time"]
        indexes = [
            models.Index(fields=["appointment_date", "status"]),
            models.Index(fields=["patient", "appointment_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["appointment_date", "appointment_time"],
                condition=~models.Q(status__in=SLOT_RELEASING_STATUSES),
                name="unique_active_appointment_slot",
            )
        ]

    def __str__(self) -> str:
        return f"{self.patient_name} - {self.appointment_date} {self.appointment_time}"

    @property
    def needs_patient_review(self) -> bool:
        return self.match_status == self.MatchStatus.AMBIGUOUS
