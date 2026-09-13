from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from ..models import (
    Appointment,
    ClinicalVisit,
    PatientDocument,
    Prescription,
    PrescriptionItem,
    Treatment,
)
from .patients import PatientChildSerializer
from .scheduling import PatientBriefSerializer


class TreatmentSerializer(PatientChildSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    visit = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=ClinicalVisit.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Treatment
        fields = [
            "id",
            "patient",
            "visit",
            "name",
            "tooth_number",
            "surfaces",
            "description",
            "status",
            "status_display",
            "performed_date",
            "cost",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = [
            "id",
            "medication_name",
            "dosage",
            "frequency",
            "duration",
            "instructions",
        ]
        read_only_fields = ["id"]


class PrescriptionSerializer(PatientChildSerializer):
    """A prescription and its lines are one unit - a prescription with no
    medications is meaningless, so items are written nested rather than
    through a second round-trip that could half-fail."""

    items = PrescriptionItemSerializer(many=True)
    visit = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=ClinicalVisit.objects.all(),
        required=False,
        allow_null=True,
    )
    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    prescribed_by_name = serializers.CharField(
        source="prescribed_by.name", read_only=True, default=None
    )

    class Meta:
        model = Prescription
        fields = [
            "uuid",
            "patient",
            "patient_detail",
            "visit",
            "prescribed_by_name",
            "prescribed_date",
            "notes",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "created_at", "updated_at"]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "A prescription needs at least one medication."
            )
        return value

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        prescription = Prescription.objects.create(**validated_data)
        PrescriptionItem.objects.bulk_create(
            [PrescriptionItem(prescription=prescription, **item) for item in items]
        )
        return prescription

    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        validated_data.pop("patient", None)
        instance = super().update(instance, validated_data)
        if items is not None:
            # Lines have no identity of their own; replacing the set wholesale
            # is simpler and safer than diffing rows the client may reorder.
            instance.items.all().delete()
            PrescriptionItem.objects.bulk_create(
                [PrescriptionItem(prescription=instance, **item) for item in items]
            )
        return instance


class PatientDocumentSerializer(PatientChildSerializer):
    document_type_display = serializers.CharField(
        source="get_document_type_display", read_only=True
    )
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    visit = serializers.SlugRelatedField(
        slug_field="uuid",
        queryset=ClinicalVisit.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = PatientDocument
        fields = [
            "uuid",
            "patient",
            "visit",
            "title",
            "document_type",
            "document_type_display",
            "file",
            "file_url",
            "file_name",
            "notes",
            "created_at",
        ]
        read_only_fields = ["uuid", "created_at"]
        extra_kwargs = {"file": {"write_only": True}}

    def get_file_url(self, obj) -> str | None:
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def get_file_name(self, obj) -> str:
        return obj.file.name.rsplit("/", 1)[-1] if obj.file else ""


class ClinicalVisitSerializer(PatientChildSerializer):
    """The clinical record of an encounter.

    Kept separate from Appointment throughout: an appointment can be cancelled
    or missed and still exist, while a visit only exists because someone was
    actually seen.
    """

    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    provider_name = serializers.CharField(
        source="provider.name", read_only=True, default=None
    )
    appointment_id = serializers.PrimaryKeyRelatedField(
        source="appointment",
        queryset=Appointment.objects.all(),
        required=False,
        allow_null=True,
    )
    treatments = TreatmentSerializer(many=True, read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True)

    class Meta:
        model = ClinicalVisit
        fields = [
            "uuid",
            "patient",
            "patient_detail",
            "appointment_id",
            "provider_name",
            "visit_date",
            "visit_time",
            "chief_complaint",
            "history_of_present_illness",
            "clinical_examination",
            "diagnosis",
            "treatment_performed",
            "clinical_notes",
            "follow_up_instructions",
            "next_visit_recommendation",
            "next_visit_date",
            "status",
            "status_display",
            "completed_at",
            "treatments",
            "prescriptions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["uuid", "completed_at", "created_at", "updated_at"]

    def validate_appointment_id(self, value):
        """An appointment yields at most one visit.

        Without this the OneToOne raises a database error the user can't act
        on; caught here it becomes a sentence telling them the visit exists.
        """
        if value is None:
            return value
        existing = getattr(value, "visit", None)
        if existing is not None and existing.pk != getattr(self.instance, "pk", None):
            raise serializers.ValidationError(
                "A clinical visit has already been recorded for this appointment."
            )
        return value

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        appointment = attrs.get("appointment", getattr(self.instance, "appointment", None))
        if (
            appointment is not None
            and appointment.patient_id is not None
            and patient is not None
            and appointment.patient_id != patient.pk
        ):
            raise serializers.ValidationError(
                {"appointment_id": "That appointment belongs to a different patient."}
            )
        return attrs


class ClinicalVisitListSerializer(serializers.ModelSerializer):
    """Row form for visit history lists."""

    patient_detail = PatientBriefSerializer(source="patient", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    treatment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ClinicalVisit
        fields = [
            "uuid",
            "patient_detail",
            "visit_date",
            "visit_time",
            "chief_complaint",
            "diagnosis",
            "status",
            "status_display",
            "treatment_count",
            "created_at",
        ]


class CompleteVisitSerializer(serializers.Serializer):
    """Sign-off action. Optionally closes the originating appointment too,
    which is the normal end of the chairside workflow."""

    complete_appointment = serializers.BooleanField(default=True)

    def save(self, **kwargs):
        visit = self.context["visit"]
        now = timezone.now()
        with transaction.atomic():
            visit.status = ClinicalVisit.Status.COMPLETED
            visit.completed_at = now
            visit.save(update_fields=["status", "completed_at", "updated_at"])

            appointment = visit.appointment
            if (
                self.validated_data.get("complete_appointment")
                and appointment is not None
                and appointment.status
                not in (
                    Appointment.Status.COMPLETED,
                    Appointment.Status.CANCELLED,
                    Appointment.Status.NO_SHOW,
                )
            ):
                appointment.status = Appointment.Status.COMPLETED
                appointment.completed_at = now
                appointment.save(update_fields=["status", "completed_at", "updated_at"])
        return visit
