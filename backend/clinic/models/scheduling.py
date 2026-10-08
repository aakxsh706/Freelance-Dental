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

# Sources that do not reserve a place in the appointment book. A walk-in is an
# unscheduled arrival: it is stamped with the clock time the person came
# through the door, which is not a bookable slot and must not block one. Two
# people can also walk in during the same minute. Excluded from both the
# uniqueness constraint and the availability calculation, so the two agree.
NON_RESERVING_SOURCES = ("walk_in",)


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
    NON_RESERVING_SOURCES = NON_RESERVING_SOURCES

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

    # What the patient originally asked for, frozen at booking time.
    #
    # Separate from appointment_date/time, which are the *current* schedule and
    # move when staff reschedule. The clinic routinely approves a request at a
    # different time than the one asked for, and the confirmation email has to
    # say "you asked for 10:30, you are confirmed for 11:30" - which is
    # impossible once the original has been overwritten.
    requested_date = models.DateField(null=True, blank=True)
    requested_time = models.TimeField(null=True, blank=True)

    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="confirmed_appointments",
    )

    # Arrival is a different event from the scheduled time and never overwrites
    # it. A patient booked at 10:30 who arrives at 11:15 keeps 10:30 as their
    # appointment_time - the schedule is what was agreed, checked_in_at is what
    # happened, and the gap between them is the clinic's running-late figure.
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="checked_in_appointments",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=255, blank=True)

    # Set when staff deliberately booked over an existing appointment. The
    # uniqueness constraint below exempts these rows: the constraint exists to
    # stop accidental double-booking, and an override is the opposite of an
    # accident - it is a decision, made by someone authorised, with a reason.
    slot_override = models.BooleanField(default=False)
    slot_override_reason = models.CharField(max_length=255, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_appointments",
    )

    # The sheet row's own stable id (a UUID the Apps Script generates), set
    # only on appointments created through the sheet webhook. The idempotency
    # key for that path: a retried or re-synced row looks up this field before
    # creating anything, so the same booking can be pushed any number of times
    # without becoming two appointments. Null for every appointment made any
    # other way (walk-in, staff-entered, old data) - SQLite and Postgres both
    # allow any number of NULLs under a unique constraint, so this never
    # collides with the rows that simply do not use it.
    external_reference = models.CharField(
        max_length=100, null=True, blank=True, unique=True
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
            # The database is the last line of defence against two patients
            # being given the same slot by two staff members at once. It covers
            # only appointments that actually reserve a slot: not cancelled or
            # no-show rows (the time is free again), not walk-ins (never
            # reserved a slot), and not deliberate overrides.
            models.UniqueConstraint(
                fields=["appointment_date", "appointment_time"],
                condition=(
                    ~models.Q(status__in=SLOT_RELEASING_STATUSES)
                    & ~models.Q(source__in=NON_RESERVING_SOURCES)
                    & models.Q(slot_override=False)
                ),
                name="unique_active_appointment_slot",
            )
        ]
        permissions = [
            (
                "override_appointment_slot",
                "Can book over an existing appointment (slot conflict override)",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.patient_name} - {self.appointment_date} {self.appointment_time}"

    @property
    def needs_patient_review(self) -> bool:
        return self.match_status == self.MatchStatus.AMBIGUOUS

    @property
    def was_moved_before_confirming(self) -> bool:
        """True when the approved time differs from the one requested.

        Drives the extra line in the confirmation email, so a patient who asked
        for 10:30 and was given 11:30 is told plainly rather than being left to
        spot the difference.
        """
        if self.requested_date is None or self.requested_time is None:
            return False
        return (
            self.requested_date != self.appointment_date
            or self.requested_time != self.appointment_time
        )

    def save(self, *args, **kwargs):
        """Freeze the requested schedule on first save only.

        Never refreshed afterwards: a reschedule changes what the appointment
        *is*, not what was originally asked for.
        """
        if self._state.adding and self.requested_date is None:
            self.requested_date = self.appointment_date
            self.requested_time = self.appointment_time
        super().save(*args, **kwargs)

    @property
    def reserves_a_slot(self) -> bool:
        """Whether this row occupies a bookable slot in the appointment book."""
        return (
            self.status not in SLOT_RELEASING_STATUSES
            and self.source not in NON_RESERVING_SOURCES
            and not self.slot_override
        )

    @property
    def arrival_delay_minutes(self) -> int | None:
        """Minutes between the booked time and the patient actually arriving.

        Negative when they arrived early. None until they check in, and None
        for walk-ins, whose scheduled time is their arrival time by definition
        so the difference would be a meaningless zero.
        """
        if not self.checked_in_at or self.source in NON_RESERVING_SOURCES:
            return None
        from datetime import datetime

        from django.utils import timezone

        scheduled = datetime.combine(self.appointment_date, self.appointment_time)
        if timezone.is_aware(self.checked_in_at):
            scheduled = timezone.make_aware(
                scheduled, timezone.get_current_timezone()
            )
        return round((self.checked_in_at - scheduled).total_seconds() / 60)
