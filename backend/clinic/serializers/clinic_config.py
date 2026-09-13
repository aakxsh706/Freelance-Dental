from rest_framework import serializers

from ..models import BlockedDate, ClinicSettings, Dentist, DentistAvailability


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


class AvailableSlotSerializer(serializers.Serializer):
    time = serializers.CharField()
    status = serializers.CharField()
