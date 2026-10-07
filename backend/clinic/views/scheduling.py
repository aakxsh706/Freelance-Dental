"""Appointment endpoints.

Shared between the public website (create only) and the clinic software
(everything else) - one appointment table, one set of availability rules, no
synchronisation step between the two.
"""

from datetime import date as date_cls, timedelta

from django.db.models import Count, Prefetch, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..appointment_events import record_event
from ..audit import record_audit, summarize_changes
from ..matching import build_patient_from_booking, normalize_phone
from ..models import Appointment, AppointmentNotification, Patient
from ..permissions import IsClinicStaff
from ..serializers import (
    AppointmentCreateSerializer,
    ConflictingAppointmentSerializer,
    SlotConflict,
    AppointmentResolvePatientSerializer,
    AppointmentSerializer,
    AppointmentStatusUpdateSerializer,
    PatientSerializer,
    StaffAppointmentWriteSerializer,
)
from ..permissions import can_override_slot
from .appointment_actions import (
    AppointmentActionsMixin,
    WalkInMixin,
    notification_payload,
)
from .mixins import OptInPageNumberPagination

AUDIT_FIELDS = (
    "patient_name",
    "phone",
    "appointment_date",
    "appointment_time",
    "status",
    "reason",
)


class AppointmentViewSet(AppointmentActionsMixin, WalkInMixin, viewsets.ModelViewSet):
    """
    - create: public (a patient booking an appointment)
    - everything else: clinic staff

    A booking made on the website is visible here the moment it is saved;
    there is no import step, because both surfaces read the same table.
    """

    queryset = (
        Appointment.objects.select_related("patient", "confirmed_by", "checked_in_by")
        .prefetch_related(
            Prefetch(
                "notifications",
                queryset=AppointmentNotification.objects.order_by("-created_at"),
            )
        )
        .annotate(
            reschedule_count=Count(
                "history", filter=Q(history__event_type="rescheduled"), distinct=True
            )
        )
        # annotate() introduces a GROUP BY, which discards Meta.ordering. Without
        # restoring it the list is unordered, and an unordered queryset paginates
        # inconsistently - the same row can appear on two pages while another is
        # never shown. `id` is the tiebreaker so the order is total.
        .order_by("appointment_date", "appointment_time", "id")
    )
    pagination_class = OptInPageNumberPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            # Staff-created appointments choose a patient explicitly; public
            # bookings go through matching instead.
            if self.request.user and self.request.user.is_authenticated:
                return StaffAppointmentWriteSerializer
            return AppointmentCreateSerializer
        if self.action == "partial_update":
            fields = set(self.request.data.keys())
            # A status-only PATCH keeps the original narrow contract; anything
            # broader is a full edit and is validated as one.
            if fields <= {"status", "cancellation_reason"}:
                return AppointmentStatusUpdateSerializer
            return StaffAppointmentWriteSerializer
        return AppointmentSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        return [IsClinicStaff()]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        target_date = params.get("date")
        if target_date:
            queryset = queryset.filter(appointment_date=target_date)

        date_from = params.get("date_from")
        if date_from:
            queryset = queryset.filter(appointment_date__gte=date_from)
        date_to = params.get("date_to")
        if date_to:
            queryset = queryset.filter(appointment_date__lte=date_to)

        if params.get("today") in ("1", "true", "True"):
            queryset = queryset.filter(appointment_date=date_cls.today())

        if params.get("upcoming") in ("1", "true", "True"):
            queryset = queryset.filter(
                appointment_date__gte=date_cls.today(),
                status__in=Appointment.OPEN_STATUSES,
            )

        status_filter = params.get("status")
        if status_filter:
            # Comma-separated so the board can ask for several at once.
            queryset = queryset.filter(status__in=[s for s in status_filter.split(",") if s])

        patient_uuid = params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)

        source = params.get("source")
        if source:
            # Comma-separated so "website bookings and phone" is one request.
            queryset = queryset.filter(source__in=[s for s in source.split(",") if s])

        if params.get("needs_review") in ("1", "true", "True"):
            queryset = queryset.filter(match_status=Appointment.MatchStatus.AMBIGUOUS)

        search = (params.get("search") or "").strip()
        if search:
            criteria = (
                Q(patient_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
                | Q(reason__icontains=search)
                | Q(patient__patient_code__icontains=search)
            )
            digits = normalize_phone(search)
            if digits:
                criteria |= Q(patient__phone_normalized=digits)
            queryset = queryset.filter(criteria)

        ordering = params.get("ordering")
        if ordering == "-date":
            return queryset.order_by("-appointment_date", "-appointment_time", "-id")
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except SlotConflict as conflict:
            return Response(
                {
                    "detail": "This time slot is already occupied.",
                    "conflict": ConflictingAppointmentSerializer(conflict.conflicting).data,
                    "can_override": can_override_slot(request.user),
                },
                status=status.HTTP_409_CONFLICT,
            )
        if serializer.validated_data.get("_conflict") is not None and not can_override_slot(
            request.user
        ):
            return Response(
                {
                    "detail": (
                        "You do not have permission to book over an existing appointment."
                    ),
                    "conflict": ConflictingAppointmentSerializer(
                        serializer.validated_data["_conflict"]
                    ).data,
                    "can_override": False,
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        appointment = serializer.save()
        if request.user and request.user.is_authenticated:
            appointment.created_by = request.user
            appointment.save(update_fields=["created_by"])
        record_event(
            appointment,
            event_type="created",
            request=request,
            new_status=appointment.status,
            detail={"source": appointment.source},
        )

        # Booking deliberately sends no email. The clinic writes to the patient
        # once, when the appointment is actually confirmed - an acknowledgement
        # for a request that may still be declined was more noise than signal.
        # The response still carries a notification payload so the public
        # confirmation screen keeps its shape; it simply reports nothing sent.
        notification = None
        if appointment.slot_override:
            record_event(
                appointment,
                event_type="slot_override",
                request=request,
                reason=appointment.slot_override_reason,
            )
        body = AppointmentSerializer(
            appointment, context=self.get_serializer_context()
        ).data
        # The public confirmation screen uses this to tell the patient where the
        # acknowledgement went, and to be honest when it could not be sent.
        body["notification"] = notification_payload(notification)
        return Response(body, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        before = {field: getattr(instance, field) for field in AUDIT_FIELDS}
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance.refresh_from_db()
        after = {field: getattr(instance, field) for field in AUDIT_FIELDS}
        record_audit(
            request,
            action="update",
            instance=instance,
            patient=instance.patient,
            changes=summarize_changes(before, after),
        )
        return Response(
            AppointmentSerializer(instance, context=self.get_serializer_context()).data
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request,
            action="delete",
            instance=instance,
            patient=instance.patient,
            changes={
                "appointment_date": str(instance.appointment_date),
                "appointment_time": str(instance.appointment_time),
            },
        )
        instance.delete()

    @action(detail=False, methods=["get"], url_path="needs-review")
    def needs_review(self, request):
        """Website bookings the matcher would not guess at.

        These are the duplicates-in-waiting: staff say which patient the
        booking belongs to, or ask for a new record.
        """
        queryset = self.get_queryset().filter(
            match_status=Appointment.MatchStatus.AMBIGUOUS
        )
        data = AppointmentSerializer(
            queryset, many=True, context=self.get_serializer_context()
        ).data
        for row, appointment in zip(data, queryset):
            row["candidates"] = PatientSerializer(
                Patient.objects.filter(pk__in=appointment.match_candidates or []),
                many=True,
                context=self.get_serializer_context(),
            ).data
        return Response(data)

    @action(detail=True, methods=["post"], url_path="resolve-patient")
    def resolve_patient(self, request, pk=None):
        """Staff decision on an ambiguous booking."""
        appointment = self.get_object()
        serializer = AppointmentResolvePatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data.get("create_new"):
            patient = build_patient_from_booking(
                appointment.patient_name, appointment.phone, appointment.email
            )
            match_status = Appointment.MatchStatus.CREATED
        else:
            patient = Patient.objects.filter(
                uuid=serializer.validated_data["patient"]
            ).first()
            if patient is None:
                raise ValidationError({"patient": "No patient found with that identifier."})
            match_status = Appointment.MatchStatus.LINKED

        appointment.patient = patient
        appointment.match_status = match_status
        appointment.match_candidates = []
        appointment.save(update_fields=["patient", "match_status", "match_candidates"])
        record_audit(
            request,
            action="update",
            instance=appointment,
            patient=patient,
            changes={"resolved_patient": patient.patient_code},
        )
        return Response(
            AppointmentSerializer(appointment, context=self.get_serializer_context()).data
        )

    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """Appointments for a date range, for the day/week/month views.

        The range is capped: a mistyped date must not turn into a request for
        every appointment the clinic has ever had.
        """
        start_raw = request.query_params.get("start") or date_cls.today().isoformat()
        end_raw = request.query_params.get("end") or start_raw
        try:
            start = date_cls.fromisoformat(start_raw)
            end = date_cls.fromisoformat(end_raw)
        except ValueError as exc:
            raise ValidationError({"start": "Dates must be in YYYY-MM-DD format."}) from exc
        if end < start:
            raise ValidationError({"end": "The end date must not be before the start date."})
        if (end - start) > timedelta(days=62):
            raise ValidationError({"end": "Please request a range of 62 days or fewer."})

        queryset = (
            self.get_queryset()
            .filter(appointment_date__gte=start, appointment_date__lte=end)
            .order_by("appointment_date", "appointment_time")
        )
        return Response(
            {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "appointments": AppointmentSerializer(
                    queryset, many=True, context=self.get_serializer_context()
                ).data,
            }
        )
