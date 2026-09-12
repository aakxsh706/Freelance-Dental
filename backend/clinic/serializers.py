from datetime import date as date_cls

from django.db import IntegrityError, transaction
from rest_framework import serializers

from .availability import compute_available_slots, slot_is_available
from .models import Appointment, BlockedDate, ClinicSettings, Dentist, DentistAvailability


class DentistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dentist
        fields = ["id", "name", "title", "email", "phone", "bio", "profile_image"]


class ClinicSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicSettings
        fields = [
            "clinic_name",
            "phone",
            "email",
            "address",
            "google_maps_embed_url",
            "google_maps_url",
            "slot_duration_minutes",
        ]


class DentistAvailabilitySerializer(serializers.ModelSerializer):
    day_of_week_display = serializers.CharField(
        source="get_day_of_week_display", read_only=True
    )

    class Meta:
        model = DentistAvailability
        fields = [
            "id",
            "day_of_week",
            "day_of_week_display",
            "start_time",
            "end_time",
            "is_active",
        ]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError("Start time must be before end time.")
        return attrs


class BlockedDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlockedDate
        fields = ["id", "date", "reason"]


class AppointmentSerializer(serializers.ModelSerializer):
    """Full appointment detail — used by the authenticated dentist dashboard."""

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
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ["status"]


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
        # UniqueConstraint, but it ignores the constraint's `condition` — it would
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
        try:
            with transaction.atomic():
                return Appointment.objects.create(**validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {
                    "appointment_time": (
                        "Please select an available appointment time. "
                        "Someone just booked this slot."
                    )
                }
            ) from exc


class AvailableSlotSerializer(serializers.Serializer):
    time = serializers.CharField()
    status = serializers.CharField()
