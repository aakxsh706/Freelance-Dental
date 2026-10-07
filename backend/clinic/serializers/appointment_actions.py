"""Serializers for the appointment workflow actions.

One serializer per action rather than a single permissive update serializer.
"Reschedule" and "edit the notes" are different operations with different
rules - a reschedule needs a reason and an availability check, a note edit
needs neither - and collapsing them into one PATCH makes it impossible to
require the reason.
"""

from datetime import date as date_cls, timedelta

from django.utils import timezone
from rest_framework import serializers

from ..availability import slot_conflicts, slot_is_available
from ..models import Appointment, AppointmentHistory, AppointmentNotification, Patient


class ConflictingAppointmentSerializer(serializers.ModelSerializer):
    """The appointment a proposed booking would collide with.

    Returned on a 409 so the interface can name who is already in that slot
    instead of an unhelpful "unavailable".
    """

    patient_code = serializers.CharField(
        source="patient.patient_code", read_only=True, default=None
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient_name",
            "patient_code",
            "appointment_date",
            "appointment_time",
            "status",
            "status_display",
            "reason",
        ]


class AppointmentHistorySerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(
        source="get_event_type_display", read_only=True
    )
    schedule_changed = serializers.BooleanField(read_only=True)

    class Meta:
        model = AppointmentHistory
        fields = [
            "id",
            "event_type",
            "event_type_display",
            "changed_by_name",
            "old_date",
            "old_time",
            "new_date",
            "new_time",
            "old_status",
            "new_status",
            "reason",
            "detail",
            "schedule_changed",
            "created_at",
        ]
        read_only_fields = fields


class AppointmentNotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AppointmentNotification
        fields = [
            "id",
            "notification_type",
            "notification_type_display",
            "recipient_email",
            "subject",
            "status",
            "status_display",
            "sent_at",
            "failure_reason",
            "attempts",
            "created_at",
        ]
        read_only_fields = fields


class ConfirmAppointmentSerializer(serializers.Serializer):
    """Accepting a pending booking. Nothing to supply - the action is the input."""

    notify = serializers.BooleanField(
        default=True,
        help_text="Send the patient a confirmation email. Off for a booking already confirmed by phone.",
    )

    def validate(self, attrs):
        appointment = self.context["appointment"]
        if appointment.status == Appointment.Status.CONFIRMED:
            raise serializers.ValidationError("This appointment is already confirmed.")
        if appointment.status not in (
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
        ):
            raise serializers.ValidationError(
                f"An appointment that is {appointment.get_status_display().lower()} "
                "cannot be confirmed."
            )
        return attrs


class SlotSensitiveSerializer(serializers.Serializer):
    """Shared availability handling for actions that place an appointment in time.

    `override` is not a boolean that skips validation - it is a deliberate,
    reasoned act that must be permitted and is always recorded. Whether the
    caller *may* override is decided by the view against the Django permission;
    this only enforces that they said why.
    """

    override = serializers.BooleanField(default=False)
    override_reason = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )

    def _check_slot(self, new_date, new_time, exclude_pk):
        attrs = self.initial_data
        conflicts = slot_conflicts(new_date, new_time, exclude_pk=exclude_pk)
        if not conflicts.exists():
            return None
        if not attrs.get("override"):
            # Surfaced as a 409 by the view, carrying the clashing appointment
            # so staff can decide between another time and an override.
            raise SlotConflict(conflicts.first())
        if not (attrs.get("override_reason") or "").strip():
            raise serializers.ValidationError(
                {"override_reason": "A reason is required to book over an existing appointment."}
            )
        return conflicts.first()


class SlotConflict(Exception):
    """Raised when a slot is taken and the caller did not ask to override."""

    def __init__(self, conflicting_appointment):
        self.conflicting = conflicting_appointment
        super().__init__("Appointment slot is already occupied.")


class RescheduleAppointmentSerializer(SlotSensitiveSerializer):
    """Moving an appointment to a different date or time.

    The reason is required: a rescheduled appointment without one is a record
    that something changed but not why, which is exactly the question asked
    later when a patient disputes the change.
    """

    appointment_date = serializers.DateField()
    appointment_time = serializers.TimeField()
    reason = serializers.CharField(max_length=255)
    notify = serializers.BooleanField(default=True)

    def validate_reason(self, value):
        if not value.strip():
            raise serializers.ValidationError("Please say why this appointment is moving.")
        return value.strip()

    def validate_appointment_date(self, value):
        if value < date_cls.today():
            raise serializers.ValidationError(
                "Please choose a date that is today or in the future."
            )
        return value

    def validate(self, attrs):
        appointment = self.context["appointment"]
        if appointment.status in (
            Appointment.Status.COMPLETED,
            Appointment.Status.CANCELLED,
            Appointment.Status.NO_SHOW,
        ):
            raise serializers.ValidationError(
                f"An appointment that is {appointment.get_status_display().lower()} "
                "cannot be rescheduled. Book a new appointment instead."
            )

        new_date = attrs["appointment_date"]
        new_time = attrs["appointment_time"]
        if (
            new_date == appointment.appointment_date
            and new_time == appointment.appointment_time
        ):
            raise serializers.ValidationError(
                "That is already this appointment's date and time."
            )

        # Working hours, blocked dates and the slot grid, from the same service
        # the public booking form uses - there is one definition of "open".
        if not attrs.get("override") and not slot_is_available(
            new_date, new_time, exclude_pk=appointment.pk
        ):
            if not slot_conflicts(new_date, new_time, exclude_pk=appointment.pk).exists():
                raise serializers.ValidationError(
                    {
                        "appointment_time": (
                            "The clinic is not open at that time. Choose a slot within "
                            "working hours, and check the date is not a holiday."
                        )
                    }
                )

        attrs["_conflict"] = self._check_slot(new_date, new_time, appointment.pk)
        return attrs


class EditAppointmentSerializer(SlotSensitiveSerializer):
    """Administrative edits.

    Deliberately narrow. Status is not editable here - status moves through its
    own guarded transitions - and neither are the patient link or the booking
    source, which are records of how this appointment came to exist.
    """

    reason = serializers.CharField(max_length=255, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    appointment_date = serializers.DateField(required=False)
    appointment_time = serializers.TimeField(required=False)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    change_reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    notify = serializers.BooleanField(default=True)

    def validate(self, attrs):
        appointment = self.context["appointment"]
        new_date = attrs.get("appointment_date", appointment.appointment_date)
        new_time = attrs.get("appointment_time", appointment.appointment_time)
        moved = (
            new_date != appointment.appointment_date
            or new_time != appointment.appointment_time
        )
        if moved:
            if appointment.status in (
                Appointment.Status.COMPLETED,
                Appointment.Status.CANCELLED,
                Appointment.Status.NO_SHOW,
            ):
                raise serializers.ValidationError(
                    "The date and time of a closed appointment cannot be changed."
                )
            attrs["_conflict"] = self._check_slot(new_date, new_time, appointment.pk)
        attrs["_moved"] = moved
        return attrs


class CheckInSerializer(serializers.Serializer):
    """Recording that the patient arrived.

    `arrived_at` defaults to now but is editable, because reception is often
    busy at the moment someone walks in and records it a few minutes later.
    Correcting it never touches the scheduled time - see §20: those are
    different events and the gap between them is the clinic's punctuality.
    """

    arrived_at = serializers.DateTimeField(required=False)

    def validate_arrived_at(self, value):
        if value > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError(
                "Arrival time cannot be in the future."
            )
        return value

    def validate(self, attrs):
        appointment = self.context["appointment"]
        if appointment.status in (
            Appointment.Status.CANCELLED,
            Appointment.Status.NO_SHOW,
            Appointment.Status.COMPLETED,
        ):
            raise serializers.ValidationError(
                f"An appointment that is {appointment.get_status_display().lower()} "
                "cannot be checked in."
            )
        return attrs


class CancelAppointmentSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    notify = serializers.BooleanField(default=True)

    def validate(self, attrs):
        appointment = self.context["appointment"]
        if appointment.status == Appointment.Status.CANCELLED:
            raise serializers.ValidationError("This appointment is already cancelled.")
        if appointment.status == Appointment.Status.COMPLETED:
            raise serializers.ValidationError(
                "A completed appointment cannot be cancelled."
            )
        return attrs


class WalkInSerializer(serializers.Serializer):
    """Registering someone who arrived without an appointment.

    Accepts either an existing patient (`patient` uuid) or the minimum fields
    to create one, so reception completes the whole thing on one screen rather
    than navigating away to the patient form and back.

    A walk-in is not a booking: it is stamped with the time the person came
    through the door and does not reserve a slot, so it never blocks a booked
    appointment and two people may walk in during the same minute.
    """

    patient = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Patient.objects.all(), required=False, allow_null=True
    )
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)

    reason = serializers.CharField(max_length=255)
    arrived_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_reason(self, value):
        if not value.strip():
            raise serializers.ValidationError("Please record why the patient has come in.")
        return value.strip()

    def validate_arrived_at(self, value):
        if value > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError("Arrival time cannot be in the future.")
        return value

    def validate(self, attrs):
        if not attrs.get("patient") and not (attrs.get("first_name") or "").strip():
            raise serializers.ValidationError(
                {
                    "patient": (
                        "Select an existing patient, or enter a first name to create "
                        "a new patient record."
                    )
                }
            )
        return attrs
