from datetime import date as date_cls

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from ..availability import slot_is_available
from ..matching import resolve_patient_for_booking
from ..models import Appointment, Patient

# Moving between these is either meaningless or destroys history, so the
# transition table below is enforced rather than trusting the client to only
# send sensible values. Terminal states are deliberately dead ends.
ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"confirmed", "checked_in", "cancelled", "no_show", "completed"},
    "confirmed": {"checked_in", "completed", "cancelled", "no_show", "pending"},
    "checked_in": {"completed", "cancelled", "no_show"},
    "completed": set(),
    "cancelled": set(),
    "no_show": set(),
}


class PatientBriefSerializer(serializers.ModelSerializer):
    """Just enough patient to render an appointment row and link to the file."""

    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = Patient
        fields = ["uuid", "patient_code", "full_name", "phone", "age"]


class AppointmentSerializer(serializers.ModelSerializer):
    """Full appointment detail - used by the authenticated clinic software.

    The snapshot fields (patient_name/phone/email) stay in the payload for the
    existing dashboard and for appointments predating patient records.
    """

    patient = PatientBriefSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    needs_patient_review = serializers.BooleanField(read_only=True)
    has_visit = serializers.SerializerMethodField()
    visit_uuid = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "phone",
            "email",
            "reason",
            "appointment_date",
            "appointment_time",
            "notes",
            "status",
            "status_display",
            "source",
            "source_display",
            "match_status",
            "match_candidates",
            "needs_patient_review",
            "checked_in_at",
            "completed_at",
            "cancelled_at",
            "cancellation_reason",
            "has_visit",
            "visit_uuid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_has_visit(self, obj) -> bool:
        return getattr(obj, "visit", None) is not None

    def get_visit_uuid(self, obj):
        visit = getattr(obj, "visit", None)
        return str(visit.uuid) if visit else None


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    """Status-only PATCH, kept for the original dashboard's contract.

    Also stamps the matching timestamp, so "when was this patient checked in"
    is answerable without reading the audit log.
    """

    class Meta:
        model = Appointment
        fields = ["status", "cancellation_reason"]

    def validate_status(self, value):
        current = self.instance.status if self.instance else None
        if current is None or value == current:
            return value
        allowed = ALLOWED_STATUS_TRANSITIONS.get(current, set())
        if value not in allowed:
            raise serializers.ValidationError(
                f"An appointment that is already {current.replace('_', ' ')} cannot be "
                f"changed to {value.replace('_', ' ')}."
            )
        return value

    def update(self, instance, validated_data):
        new_status = validated_data.get("status", instance.status)
        now = timezone.now()
        if new_status != instance.status:
            if new_status == Appointment.Status.CHECKED_IN and not instance.checked_in_at:
                instance.checked_in_at = now
            elif new_status == Appointment.Status.COMPLETED:
                instance.completed_at = now
            elif new_status == Appointment.Status.CANCELLED:
                instance.cancelled_at = now
        return super().update(instance, validated_data)


class AppointmentCreateSerializer(serializers.ModelSerializer):
    """Public booking serializer. Re-validates availability at save time to
    close the race window between a patient viewing slots and submitting."""

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient_name",
            "phone",
            "email",
            "reason",
            "appointment_date",
            "appointment_time",
            "notes",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]
        # DRF auto-derives a strict unique-together validator from the model's
        # UniqueConstraint, but it ignores the constraint's `condition` - it would
        # reject rebooking a date/time whose only existing row is cancelled, and it
        # raises a generic "must make a unique set" error instead of a friendly one.
        # Availability (including reuse of cancelled slots) is enforced explicitly
        # in validate()/create() below via slot_is_available() and the DB constraint.
        validators: list = []

    def validate_appointment_date(self, value):
        if value < date_cls.today():
            raise serializers.ValidationError(
                "Please choose a date that is today or in the future."
            )
        return value

    def validate(self, attrs):
        appointment_date = attrs["appointment_date"]
        appointment_time = attrs["appointment_time"]
        if not slot_is_available(appointment_date, appointment_time):
            raise serializers.ValidationError(
                {
                    "appointment_time": (
                        "Please select an available appointment time. "
                        "This slot is no longer open."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        """Save the booking and attach it to a patient record.

        The appointment is the thing the patient is waiting on, so it is saved
        first and patient resolution follows. An ambiguous match leaves
        `patient` null and flags the row for staff rather than guessing, and a
        failure to resolve must never cost the patient their booking.
        """
        try:
            with transaction.atomic():
                appointment = Appointment.objects.create(
                    **validated_data, source=Appointment.Source.WEBSITE
                )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {
                    "appointment_time": (
                        "Please select an available appointment time. "
                        "Someone just booked this slot."
                    )
                }
            ) from exc

        patient, match_status, candidate_ids = resolve_patient_for_booking(
            name=appointment.patient_name,
            phone=appointment.phone,
            email=appointment.email,
        )
        appointment.patient = patient
        appointment.match_status = match_status
        appointment.match_candidates = candidate_ids if match_status == "ambiguous" else []
        appointment.save(update_fields=["patient", "match_status", "match_candidates"])
        return appointment


class StaffAppointmentWriteSerializer(serializers.ModelSerializer):
    """Booking from inside the clinic.

    Differs from the public serializer in three ways that matter: the patient
    is chosen explicitly rather than matched, back-dating is allowed (recording
    a walk-in that already happened), and the source defaults to `clinic`.
    Slot collision protection still applies.
    """

    patient = serializers.SlugRelatedField(
        slug_field="uuid", queryset=Patient.objects.all(), required=False, allow_null=True
    )
    # Optional on input because selecting a patient fills them in; the model
    # still requires a value, and validate() below guarantees one either way.
    patient_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "phone",
            "email",
            "reason",
            "appointment_date",
            "appointment_time",
            "notes",
            "status",
            "source",
        ]
        read_only_fields = ["id"]
        validators: list = []

    def validate(self, attrs):
        instance = self.instance
        appointment_date = attrs.get(
            "appointment_date", getattr(instance, "appointment_date", None)
        )
        appointment_time = attrs.get(
            "appointment_time", getattr(instance, "appointment_time", None)
        )
        status_value = attrs.get("status", getattr(instance, "status", "pending"))

        rescheduling = instance is None or (
            appointment_date != instance.appointment_date
            or appointment_time != instance.appointment_time
        )
        # A cancelled/no-show row holds no slot, so it needs no collision check.
        if rescheduling and status_value not in Appointment.SLOT_RELEASING_STATUSES:
            clash = (
                Appointment.objects.filter(
                    appointment_date=appointment_date, appointment_time=appointment_time
                )
                .exclude(status__in=Appointment.SLOT_RELEASING_STATUSES)
                .exclude(pk=getattr(instance, "pk", None))
                .exists()
            )
            if clash:
                raise serializers.ValidationError(
                    {"appointment_time": "That slot is already taken by another appointment."}
                )

        patient = attrs.get("patient", getattr(instance, "patient", None))
        # Staff may book without selecting a patient (a phone enquiry from
        # someone not yet on file), but then the snapshot name is required -
        # an appointment with neither is unidentifiable.
        if patient is None and not attrs.get(
            "patient_name", getattr(instance, "patient_name", "")
        ):
            raise serializers.ValidationError(
                {"patient_name": "Select a patient or enter a name for this appointment."}
            )
        return attrs

    def _fill_snapshot(self, validated_data, instance=None):
        """Copy the patient's current details onto the appointment.

        Only fills blanks: if staff typed a different number for this one
        visit, that is the number for this visit and must not be overwritten.
        """
        patient = validated_data.get("patient", getattr(instance, "patient", None))
        if patient is None:
            # No patient selected: the typed name is all there is, and
            # validate() has already insisted on one.
            validated_data.setdefault("phone", getattr(instance, "phone", "") or "")
            validated_data.setdefault("email", getattr(instance, "email", "") or "")
            return validated_data
        if not validated_data.get("patient_name") and not getattr(instance, "patient_name", ""):
            validated_data["patient_name"] = patient.full_name
        if not validated_data.get("phone") and not getattr(instance, "phone", ""):
            validated_data["phone"] = patient.phone
        if not validated_data.get("email") and not getattr(instance, "email", ""):
            validated_data["email"] = patient.email
        return validated_data

    def create(self, validated_data):
        validated_data = self._fill_snapshot(validated_data)
        validated_data.setdefault("source", Appointment.Source.CLINIC)
        if validated_data.get("patient") is not None:
            validated_data["match_status"] = Appointment.MatchStatus.LINKED
        try:
            with transaction.atomic():
                return Appointment.objects.create(**validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"appointment_time": "That slot was taken a moment ago. Please pick another."}
            ) from exc

    def update(self, instance, validated_data):
        validated_data = self._fill_snapshot(validated_data, instance)
        if validated_data.get("patient") is not None:
            validated_data["match_status"] = Appointment.MatchStatus.LINKED
        try:
            with transaction.atomic():
                return super().update(instance, validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"appointment_time": "That slot was taken a moment ago. Please pick another."}
            ) from exc


class AppointmentResolvePatientSerializer(serializers.Serializer):
    """Staff answer to an ambiguous website booking: which of these is it?"""

    patient = serializers.UUIDField(required=False, allow_null=True)
    create_new = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if not attrs.get("patient") and not attrs.get("create_new"):
            raise serializers.ValidationError(
                "Choose an existing patient or ask for a new record to be created."
            )
        return attrs
