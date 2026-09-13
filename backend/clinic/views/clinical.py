"""Clinical records: visits, treatments, prescriptions and documents."""

from datetime import date as date_cls

from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from ..audit import record_audit
from ..models import (
    Appointment,
    ClinicalVisit,
    Dentist,
    PatientDocument,
    Prescription,
    Treatment,
)
from ..permissions import CanPrescribe, CanViewClinicalRecords
from ..serializers import (
    ClinicalVisitListSerializer,
    ClinicalVisitSerializer,
    CompleteVisitSerializer,
    PatientDocumentSerializer,
    PrescriptionSerializer,
    TreatmentSerializer,
)
from .mixins import AuditedModelMixin, OptInPageNumberPagination


class ClinicalVisitViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """The chairside record.

    Created as a draft when the dentist starts seeing the patient and signed
    off with /complete/, which also closes the originating appointment.
    """

    queryset = (
        ClinicalVisit.objects.select_related("patient", "appointment", "provider")
        .annotate(treatment_count=Count("treatments"))
        .all()
    )
    permission_classes = [CanViewClinicalRecords]
    pagination_class = OptInPageNumberPagination
    lookup_field = "uuid"
    audit_fields = ("visit_date", "chief_complaint", "diagnosis", "status")

    def get_serializer_class(self):
        return ClinicalVisitListSerializer if self.action == "list" else ClinicalVisitSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        patient_uuid = params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)
        status_filter = params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        date_from = params.get("date_from")
        if date_from:
            queryset = queryset.filter(visit_date__gte=date_from)
        date_to = params.get("date_to")
        if date_to:
            queryset = queryset.filter(visit_date__lte=date_to)
        search = (params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(patient__patient_code__icontains=search)
                | Q(chief_complaint__icontains=search)
                | Q(diagnosis__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        # The provider is the clinic's dentist; recorded on the visit so the
        # record stands on its own if staff accounts change later.
        instance = serializer.save(
            created_by=self.request.user,
            provider=Dentist.objects.first(),
        )
        record_audit(
            self.request,
            action="create",
            instance=instance,
            patient=instance.patient,
            changes={"visit_date": str(instance.visit_date)},
        )
        return instance

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        record_audit(request, action="view", instance=instance, patient=instance.patient)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, uuid=None):
        visit = self.get_object()
        serializer = CompleteVisitSerializer(
            data=request.data, context={"visit": visit, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        visit = serializer.save()
        record_audit(
            request,
            action="update",
            instance=visit,
            patient=visit.patient,
            changes={"status": "completed"},
        )
        return Response(
            ClinicalVisitSerializer(visit, context=self.get_serializer_context()).data
        )

    @action(detail=False, methods=["post"], url_path="start-from-appointment")
    def start_from_appointment(self, request):
        """One click from a checked-in appointment to an open visit.

        Returns the existing visit if one was already started, so a double
        click does not create two records for the same encounter.
        """
        appointment_id = request.data.get("appointment")
        appointment = Appointment.objects.filter(pk=appointment_id).first()
        if appointment is None:
            return Response({"detail": "Appointment not found."}, status=404)
        if appointment.patient is None:
            return Response(
                {"detail": "Link this appointment to a patient before starting a visit."},
                status=400,
            )

        existing = getattr(appointment, "visit", None)
        if existing is not None:
            return Response(
                ClinicalVisitSerializer(existing, context=self.get_serializer_context()).data
            )

        visit = ClinicalVisit.objects.create(
            patient=appointment.patient,
            appointment=appointment,
            provider=Dentist.objects.first(),
            visit_date=appointment.appointment_date,
            visit_time=appointment.appointment_time,
            chief_complaint=appointment.reason or "",
            created_by=request.user,
        )
        record_audit(
            request,
            action="create",
            instance=visit,
            patient=visit.patient,
            changes={"started_from_appointment": appointment.pk},
        )
        return Response(
            ClinicalVisitSerializer(visit, context=self.get_serializer_context()).data,
            status=201,
        )


class TreatmentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = Treatment.objects.select_related("patient", "visit").all()
    serializer_class = TreatmentSerializer
    permission_classes = [CanViewClinicalRecords]
    pagination_class = OptInPageNumberPagination
    audit_fields = ("name", "tooth_number", "status", "performed_date")

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        patient_uuid = params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)
        visit_uuid = params.get("visit")
        if visit_uuid:
            queryset = queryset.filter(visit__uuid=visit_uuid)
        tooth = params.get("tooth")
        if tooth:
            queryset = queryset.filter(tooth_number=tooth)
        status_filter = params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


class PrescriptionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    queryset = (
        Prescription.objects.select_related("patient", "visit", "prescribed_by")
        .prefetch_related("items")
        .all()
    )
    serializer_class = PrescriptionSerializer
    permission_classes = [CanPrescribe]
    pagination_class = OptInPageNumberPagination
    lookup_field = "uuid"
    audit_fields = ("prescribed_date", "notes")

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        patient_uuid = params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)
        visit_uuid = params.get("visit")
        if visit_uuid:
            queryset = queryset.filter(visit__uuid=visit_uuid)
        date_from = params.get("date_from")
        if date_from:
            queryset = queryset.filter(prescribed_date__gte=date_from)
        search = (params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(patient__patient_code__icontains=search)
                | Q(items__medication_name__icontains=search)
            ).distinct()
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            prescribed_by=Dentist.objects.first(),
        )
        record_audit(
            self.request,
            action="create",
            instance=instance,
            patient=instance.patient,
            changes={"items": [item.medication_name for item in instance.items.all()]},
        )
        return instance


class PatientDocumentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Uploads (x-rays, reports, consent forms) attached to a patient."""

    queryset = PatientDocument.objects.select_related("patient", "visit").all()
    serializer_class = PatientDocumentSerializer
    permission_classes = [CanViewClinicalRecords]
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = OptInPageNumberPagination
    lookup_field = "uuid"
    audit_fields = ("title", "document_type")

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_uuid = self.request.query_params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)
        elif self.action == "list":
            return queryset.none()
        visit_uuid = self.request.query_params.get("visit")
        if visit_uuid:
            queryset = queryset.filter(visit__uuid=visit_uuid)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(uploaded_by=self.request.user)
        record_audit(
            self.request,
            action="create",
            instance=instance,
            patient=instance.patient,
            changes={"title": instance.title, "type": instance.document_type},
        )
        return instance

    def perform_destroy(self, instance):
        record_audit(
            self.request,
            action="delete",
            instance=instance,
            patient=instance.patient,
            changes={"title": instance.title},
        )
        # Remove the stored file too, not just the row - an orphaned x-ray on
        # disk is still patient data.
        instance.file.delete(save=False)
        instance.delete()
