"""Patient directory and the records hanging off a patient."""

from datetime import date as date_cls

from django.db import transaction
from django.db.models import Count, Max, Min, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..audit import record_audit
from ..matching import normalize_phone
from ..models import (
    Allergy,
    Appointment,
    AuditLog,
    ClinicalVisit,
    DentalHistory,
    FamilyMedicalHistory,
    Hospitalization,
    MedicalCondition,
    MedicalProfile,
    PastSurgery,
    Patient,
    PatientMedication,
    Prescription,
    Treatment,
)
from ..permissions import CanViewClinicalRecords, IsClinicStaff
from ..serializers import (
    AllergySerializer,
    AppointmentSerializer,
    AuditLogSerializer,
    ClinicalVisitListSerializer,
    DentalHistorySerializer,
    FamilyMedicalHistorySerializer,
    HospitalizationSerializer,
    MedicalConditionSerializer,
    MedicalProfileSerializer,
    PastSurgerySerializer,
    PatientListSerializer,
    PatientSerializer,
    PrescriptionSerializer,
    TreatmentSerializer,
)
from .mixins import AlwaysPageNumberPagination, AuditedModelMixin

SORTABLE_FIELDS = {
    "name": "first_name",
    "code": "patient_code",
    "created": "created_at",
    "last_visit": "last_visit_date",
    "next_appointment": "next_appointment_date",
}


class PatientViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """The patient directory.

    Search and paging happen in the database. A clinic's patient list grows
    without bound, so shipping it to the browser to filter there would get
    slower every month and would put the entire record set on any machine that
    opened the page.
    """

    serializer_class = PatientSerializer
    permission_classes = [IsClinicStaff]
    pagination_class = AlwaysPageNumberPagination
    lookup_field = "uuid"
    audit_fields = (
        "first_name",
        "last_name",
        "phone",
        "email",
        "date_of_birth",
        "gender",
        "blood_group",
        "is_active",
    )

    def get_serializer_class(self):
        return PatientListSerializer if self.action == "list" else PatientSerializer

    def get_queryset(self):
        # A patient's "last visit" and "next appointment" are the two columns
        # staff scan for, so they are annotated in SQL rather than fetched per
        # row - otherwise a 25-row page costs 51 queries.
        queryset = Patient.objects.annotate(
            last_visit_date=Max("visits__visit_date"),
            next_appointment_date=Min(
                "appointments__appointment_date",
                filter=Q(appointments__appointment_date__gte=date_cls.today())
                & Q(appointments__status__in=Appointment.OPEN_STATUSES),
            ),
        )

        params = self.request.query_params

        search = (params.get("search") or "").strip()
        if search:
            digits = normalize_phone(search)
            criteria = (
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(display_name__icontains=search)
                | Q(patient_code__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )
            # Typed spacing and +91 must not change the result, so a search
            # term that looks like a number is also matched against the
            # normalised column.
            if digits:
                criteria |= Q(phone_normalized=digits)
            queryset = queryset.filter(criteria)

        active = params.get("is_active")
        if active in ("1", "true", "True"):
            queryset = queryset.filter(is_active=True)
        elif active in ("0", "false", "False"):
            queryset = queryset.filter(is_active=False)

        gender = params.get("gender")
        if gender:
            queryset = queryset.filter(gender=gender)

        # Records merged away stay in the database for the audit trail but must
        # not clutter the directory.
        if params.get("include_merged") not in ("1", "true", "True"):
            queryset = queryset.filter(merged_into__isnull=True)

        sort = params.get("sort") or "name"
        descending = sort.startswith("-")
        field = SORTABLE_FIELDS.get(sort.lstrip("-"), "first_name")
        return queryset.order_by(f"-{field}" if descending else field)

    def retrieve(self, request, *args, **kwargs):
        """Opening a patient file is itself auditable - see AuditLog."""
        instance = self.get_object()
        record_audit(request, action="view", instance=instance, patient=instance)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["get"])
    def summary(self, request, uuid=None):
        """Everything the profile page needs, in one round trip.

        The alternative is eight parallel requests on page load, each
        re-authenticating and re-querying the same patient.
        """
        patient = self.get_object()
        record_audit(request, action="view", instance=patient, patient=patient)

        appointments = patient.appointments.select_related("patient").order_by(
            "-appointment_date", "-appointment_time"
        )
        visits = patient.visits.annotate(
            treatment_count=Count("treatments")
        ).order_by("-visit_date")
        upcoming = [
            a
            for a in appointments
            if a.appointment_date >= date_cls.today()
            and a.status in Appointment.OPEN_STATUSES
        ]

        context = self.get_serializer_context()
        return Response(
            {
                "patient": PatientSerializer(patient, context=context).data,
                # Active allergies and conditions drive the alert banner, so
                # they are sent separately from the full history lists.
                "alerts": {
                    "allergies": AllergySerializer(
                        patient.allergies.filter(is_active=True), many=True, context=context
                    ).data,
                    "conditions": MedicalConditionSerializer(
                        patient.medical_conditions.filter(
                            status__in=[MedicalCondition.Status.ACTIVE, MedicalCondition.Status.MANAGED]
                        ),
                        many=True,
                        context=context,
                    ).data,
                    "medications": PatientMedicationSerializerLazy(
                        patient.medications.filter(is_active=True), context=context
                    ),
                },
                "counts": {
                    "appointments": appointments.count(),
                    "visits": patient.visits.count(),
                    "treatments": patient.treatments.count(),
                    "prescriptions": patient.prescriptions.count(),
                    "documents": patient.documents.count(),
                },
                "recent_appointments": AppointmentSerializer(
                    appointments[:10], many=True, context=context
                ).data,
                "upcoming_appointments": AppointmentSerializer(
                    upcoming[:5], many=True, context=context
                ).data,
                "recent_visits": ClinicalVisitListSerializer(
                    visits[:10], many=True, context=context
                ).data,
                "recent_treatments": TreatmentSerializer(
                    patient.treatments.all()[:10], many=True, context=context
                ).data,
                "recent_prescriptions": PrescriptionSerializer(
                    patient.prescriptions.prefetch_related("items")[:5],
                    many=True,
                    context=context,
                ).data,
            }
        )

    @action(detail=True, methods=["get", "put", "patch"], url_path="medical-profile")
    def medical_profile(self, request, uuid=None):
        patient = self.get_object()
        profile, _ = MedicalProfile.objects.get_or_create(patient=patient)
        if request.method == "GET":
            return Response(MedicalProfileSerializer(profile).data)
        serializer = MedicalProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(request, action="update", instance=profile, patient=patient)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "put", "patch"], url_path="dental-history")
    def dental_history(self, request, uuid=None):
        patient = self.get_object()
        history, _ = DentalHistory.objects.get_or_create(patient=patient)
        if request.method == "GET":
            return Response(DentalHistorySerializer(history).data)
        serializer = DentalHistorySerializer(history, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(request, action="update", instance=history, patient=patient)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, uuid=None):
        """The complete medical and dental history in one payload."""
        patient = self.get_object()
        record_audit(request, action="view", instance=patient, patient=patient)
        profile, _ = MedicalProfile.objects.get_or_create(patient=patient)
        dental, _ = DentalHistory.objects.get_or_create(patient=patient)
        context = self.get_serializer_context()
        return Response(
            {
                "medical_profile": MedicalProfileSerializer(profile).data,
                "dental_history": DentalHistorySerializer(dental).data,
                "allergies": AllergySerializer(
                    patient.allergies.all(), many=True, context=context
                ).data,
                "conditions": MedicalConditionSerializer(
                    patient.medical_conditions.all(), many=True, context=context
                ).data,
                "medications": PatientMedicationSerializerLazy(
                    patient.medications.all(), context=context
                ),
                "surgeries": PastSurgerySerializer(
                    patient.surgeries.all(), many=True, context=context
                ).data,
                "hospitalizations": HospitalizationSerializer(
                    patient.hospitalizations.all(), many=True, context=context
                ).data,
                "family_history": FamilyMedicalHistorySerializer(
                    patient.family_history.all(), many=True, context=context
                ).data,
            }
        )

    @action(detail=True, methods=["get"], url_path="audit")
    def audit(self, request, uuid=None):
        """Who has opened or changed this patient's file."""
        patient = self.get_object()
        logs = AuditLog.objects.filter(patient=patient)[:200]
        return Response(AuditLogSerializer(logs, many=True).data)

    @action(detail=True, methods=["get"], url_path="merge-preview")
    def merge_preview(self, request, uuid=None):
        """What a merge would move, before anything is moved."""
        target = self.get_object()
        source = self._source_patient(request.query_params.get("source"))
        return Response(
            {
                "target": PatientSerializer(target, context=self.get_serializer_context()).data,
                "source": PatientSerializer(source, context=self.get_serializer_context()).data,
                "will_move": {
                    "appointments": source.appointments.count(),
                    "visits": source.visits.count(),
                    "treatments": source.treatments.count(),
                    "prescriptions": source.prescriptions.count(),
                    "documents": source.documents.count(),
                    "allergies": source.allergies.count(),
                    "conditions": source.medical_conditions.count(),
                    "medications": source.medications.count(),
                },
            }
        )

    @action(detail=True, methods=["post"])
    def merge(self, request, uuid=None):
        """Fold a duplicate record into this one.

        Everything is re-pointed rather than copied, and the source is kept as
        a tombstone pointing at the target: a merge is not reversible in
        practice, so the trail of which record absorbed which has to survive.
        Merging is restricted to roles that can edit clinical data.
        """
        target = self.get_object()
        source = self._source_patient(request.data.get("source"))

        if source.pk == target.pk:
            raise ValidationError({"source": "A patient cannot be merged into themselves."})
        if source.merged_into_id is not None:
            raise ValidationError({"source": "That record has already been merged."})

        profile = getattr(request.user, "staff_profile", None)
        if profile is not None and not profile.can_edit_clinical:
            return Response(
                {"detail": "Your role cannot merge patient records."},
                status=status.HTTP_403_FORBIDDEN,
            )

        moved = {}
        with transaction.atomic():
            for label, manager in (
                ("appointments", Appointment.objects.filter(patient=source)),
                ("visits", ClinicalVisit.objects.filter(patient=source)),
                ("treatments", Treatment.objects.filter(patient=source)),
                ("prescriptions", Prescription.objects.filter(patient=source)),
                ("documents", source.documents.all()),
                ("allergies", Allergy.objects.filter(patient=source)),
                ("conditions", MedicalCondition.objects.filter(patient=source)),
                ("medications", PatientMedication.objects.filter(patient=source)),
                ("surgeries", PastSurgery.objects.filter(patient=source)),
                ("hospitalizations", Hospitalization.objects.filter(patient=source)),
                ("family_history", FamilyMedicalHistory.objects.filter(patient=source)),
            ):
                moved[label] = manager.update(patient=target)

            # Fill gaps in the surviving record from the one being absorbed,
            # but never overwrite a value the target already has.
            for field in (
                "phone", "alternate_phone", "email", "date_of_birth", "gender",
                "blood_group", "address_line_1", "city", "state", "postal_code",
                "occupation", "emergency_contact_name", "emergency_contact_phone",
            ):
                if not getattr(target, field, None) and getattr(source, field, None):
                    setattr(target, field, getattr(source, field))
            if source.notes:
                target.notes = (
                    f"{target.notes}\n\nMerged from {source.patient_code}:\n{source.notes}"
                ).strip()
            target.save()

            source.is_active = False
            source.merged_into = target
            source.save(update_fields=["is_active", "merged_into", "updated_at"])

        record_audit(
            request,
            action="merge",
            instance=target,
            patient=target,
            changes={"merged_from": source.patient_code, "moved": moved},
        )
        return Response(
            {
                "patient": PatientSerializer(target, context=self.get_serializer_context()).data,
                "merged_from": source.patient_code,
                "moved": moved,
            }
        )

    @staticmethod
    def _source_patient(raw_uuid):
        if not raw_uuid:
            raise ValidationError({"source": "A source patient uuid is required."})
        source = Patient.objects.filter(uuid=raw_uuid).first()
        if source is None:
            raise ValidationError({"source": "No patient found with that identifier."})
        return source


def PatientMedicationSerializerLazy(queryset, context):
    """Imported lazily to keep this module's import graph acyclic."""
    from ..serializers import PatientMedicationSerializer

    return PatientMedicationSerializer(queryset, many=True, context=context).data


class PatientChildViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Base for the per-patient record lists.

    All of them are filtered by ?patient=<uuid> and all of them are clinical
    data, so the role check and the filter live here once.
    """

    permission_classes = [CanViewClinicalRecords]

    def get_queryset(self):
        queryset = self.queryset
        patient_uuid = self.request.query_params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)
        elif self.action == "list":
            # Without a patient filter this would return every record in the
            # clinic; an explicit empty result is the safer default.
            return queryset.none()
        return queryset


class AllergyViewSet(PatientChildViewSet):
    queryset = Allergy.objects.select_related("patient").all()
    serializer_class = AllergySerializer
    audit_fields = ("substance", "reaction", "severity", "is_active")


class MedicalConditionViewSet(PatientChildViewSet):
    queryset = MedicalCondition.objects.select_related("patient").all()
    serializer_class = MedicalConditionSerializer
    audit_fields = ("condition", "status", "diagnosed_date")


class PatientMedicationViewSet(PatientChildViewSet):
    queryset = PatientMedication.objects.select_related("patient").all()
    audit_fields = ("medication_name", "dosage", "frequency", "is_active")

    def get_serializer_class(self):
        from ..serializers import PatientMedicationSerializer

        return PatientMedicationSerializer


class PastSurgeryViewSet(PatientChildViewSet):
    queryset = PastSurgery.objects.select_related("patient").all()
    serializer_class = PastSurgerySerializer
    audit_fields = ("procedure", "surgery_date", "hospital")


class HospitalizationViewSet(PatientChildViewSet):
    queryset = Hospitalization.objects.select_related("patient").all()
    serializer_class = HospitalizationSerializer
    audit_fields = ("reason", "admitted_date", "discharged_date")


class FamilyMedicalHistoryViewSet(PatientChildViewSet):
    queryset = FamilyMedicalHistory.objects.select_related("patient").all()
    serializer_class = FamilyMedicalHistorySerializer
    audit_fields = ("relationship", "condition")
