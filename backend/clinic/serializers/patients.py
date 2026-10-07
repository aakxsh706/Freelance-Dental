from rest_framework import serializers

from ..identifiers import create_with_patient_code
from ..models import (
    Allergy,
    DentalHistory,
    FamilyMedicalHistory,
    Hospitalization,
    MedicalCondition,
    MedicalProfile,
    PastSurgery,
    Patient,
    PatientMedication,
)

# The API addresses patients by uuid, never by pk, so nested writes accept a
# uuid too. Declared once here and reused by every child serializer.
PATIENT_LOOKUP_FIELD = "uuid"


class PatientChildSerializer(serializers.ModelSerializer):
    """Base for anything hanging off a patient.

    The patient is supplied as a uuid and is write-once: moving a record
    between patients silently is exactly the kind of edit that corrupts a
    medical history, so a mistaken row is deleted and re-added instead.
    """

    patient = serializers.SlugRelatedField(
        slug_field=PATIENT_LOOKUP_FIELD, queryset=Patient.objects.all()
    )

    def update(self, instance, validated_data):
        validated_data.pop("patient", None)
        return super().update(instance, validated_data)


class AllergySerializer(PatientChildSerializer):
    severity_display = serializers.CharField(
        source="get_severity_display", read_only=True
    )

    class Meta:
        model = Allergy
        fields = [
            "id",
            "patient",
            "substance",
            "reaction",
            "severity",
            "severity_display",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MedicalConditionSerializer(PatientChildSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = MedicalCondition
        fields = [
            "id",
            "patient",
            "condition",
            "diagnosed_date",
            "status",
            "status_display",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PatientMedicationSerializer(PatientChildSerializer):
    class Meta:
        model = PatientMedication
        fields = [
            "id",
            "patient",
            "medication_name",
            "dosage",
            "frequency",
            "start_date",
            "end_date",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before the start date."}
            )
        return attrs


class PastSurgerySerializer(PatientChildSerializer):
    class Meta:
        model = PastSurgery
        fields = [
            "id",
            "patient",
            "procedure",
            "surgery_date",
            "year",
            "hospital",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class HospitalizationSerializer(PatientChildSerializer):
    class Meta:
        model = Hospitalization
        fields = [
            "id",
            "patient",
            "reason",
            "admitted_date",
            "discharged_date",
            "hospital",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        admitted = attrs.get("admitted_date", getattr(self.instance, "admitted_date", None))
        discharged = attrs.get(
            "discharged_date", getattr(self.instance, "discharged_date", None)
        )
        if admitted and discharged and discharged < admitted:
            raise serializers.ValidationError(
                {"discharged_date": "Discharge date cannot be before the admission date."}
            )
        return attrs


class FamilyMedicalHistorySerializer(PatientChildSerializer):
    class Meta:
        model = FamilyMedicalHistory
        fields = [
            "id",
            "patient",
            "relationship",
            "condition",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MedicalProfileSerializer(serializers.ModelSerializer):
    smoking_status_display = serializers.CharField(
        source="get_smoking_status_display", read_only=True
    )
    alcohol_use_display = serializers.CharField(
        source="get_alcohol_use_display", read_only=True
    )
    pregnancy_status_display = serializers.CharField(
        source="get_pregnancy_status_display", read_only=True
    )

    class Meta:
        model = MedicalProfile
        fields = [
            "smoking_status",
            "smoking_status_display",
            "alcohol_use",
            "alcohol_use_display",
            "pregnancy_status",
            "pregnancy_status_display",
            "other_notes",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class DentalHistorySerializer(serializers.ModelSerializer):
    oral_hygiene_display = serializers.CharField(
        source="get_oral_hygiene_display", read_only=True
    )
    brushing_frequency_display = serializers.CharField(
        source="get_brushing_frequency_display", read_only=True
    )

    class Meta:
        model = DentalHistory
        fields = [
            "previous_treatments",
            "last_dental_visit",
            "oral_hygiene",
            "oral_hygiene_display",
            "brushing_frequency",
            "brushing_frequency_display",
            "flosses",
            "tooth_sensitivity",
            "tooth_sensitivity_notes",
            "bleeding_gums",
            "gum_disease",
            "bruxism",
            "orthodontic_history",
            "orthodontic_notes",
            "has_implants",
            "has_crowns",
            "has_bridges",
            "has_dentures",
            "root_canal_history",
            "extractions",
            "dental_material_reactions",
            "notes",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class PatientListSerializer(serializers.ModelSerializer):
    """Directory row. Deliberately narrow - the list endpoint is paginated and
    must not drag every patient's full record across the wire."""

    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    last_visit_date = serializers.DateField(read_only=True)
    next_appointment_date = serializers.DateField(read_only=True)

    class Meta:
        model = Patient
        fields = [
            "uuid",
            "patient_code",
            "full_name",
            "first_name",
            "last_name",
            "phone",
            "email",
            "date_of_birth",
            "age",
            "gender",
            "is_active",
            "last_visit_date",
            "next_appointment_date",
            "created_at",
        ]


class PatientSerializer(serializers.ModelSerializer):
    """Full record, used for the profile page and for create/update.

    `patient_code` is allocated by the server, never accepted from the client.
    """

    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    gender_display = serializers.CharField(source="get_gender_display", read_only=True)
    merged_into_code = serializers.CharField(
        source="merged_into.patient_code", read_only=True, default=None
    )

    class Meta:
        model = Patient
        fields = [
            "uuid",
            "patient_code",
            "first_name",
            "last_name",
            "display_name",
            "full_name",
            "phone",
            "alternate_phone",
            "email",
            "date_of_birth",
            "age",
            "gender",
            "gender_display",
            "blood_group",
            "address_line_1",
            "address_line_2",
            "city",
            "state",
            "postal_code",
            "country",
            "emergency_contact_name",
            "emergency_contact_phone",
            "emergency_contact_relationship",
            "occupation",
            "preferred_language",
            "notes",
            "is_active",
            "merged_into_code",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "patient_code", "created_at", "updated_at"]

    def validate_first_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("A first name is required.")
        return value.strip()

    def create(self, validated_data):
        return create_with_patient_code(Patient, **validated_data)


class PatientMergePreviewSerializer(serializers.Serializer):
    """Shown before a merge so staff see exactly what will move."""

    source = serializers.UUIDField()
    confirm = serializers.BooleanField(default=False)
