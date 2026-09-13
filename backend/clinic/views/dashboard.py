"""Dashboard figures and the audit trail."""

from datetime import date as date_cls, timedelta

from django.db.models import Count, Q
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Appointment, AuditLog, ClinicalVisit, Patient
from ..permissions import CanViewAudit, IsClinicStaff, staff_profile_for
from ..serializers import (
    AppointmentSerializer,
    AuditLogSerializer,
    StaffProfileSerializer,
)
from .mixins import AlwaysPageNumberPagination


class DashboardStatsView(APIView):
    """Counts for the dashboard.

    `today_count`, `by_status` and `last_7_days` keep the exact shape the
    original dentist dashboard consumed - the clinic figures are added
    alongside rather than replacing them, so the old screen keeps working
    while the new one is built out.
    """

    permission_classes = [IsClinicStaff]

    def get(self, request):
        today = date_cls.today()
        month_start = today.replace(day=1)

        status_counts = dict(
            Appointment.objects.values_list("status")
            .annotate(total=Count("id"))
            .values_list("status", "total")
        )
        by_status = {
            value: status_counts.get(value, 0) for value, _ in Appointment.Status.choices
        }

        # One grouped query for the week rather than seven counts.
        week_start = today - timedelta(days=6)
        per_day = dict(
            Appointment.objects.filter(
                appointment_date__gte=week_start, appointment_date__lte=today
            )
            .exclude(status__in=Appointment.SLOT_RELEASING_STATUSES)
            .values_list("appointment_date")
            .annotate(total=Count("id"))
            .values_list("appointment_date", "total")
        )
        last_7_days = [
            {
                "date": (week_start + timedelta(days=offset)).isoformat(),
                "count": per_day.get(week_start + timedelta(days=offset), 0),
            }
            for offset in range(7)
        ]

        active_patients = Patient.objects.filter(merged_into__isnull=True)

        return Response(
            {
                # Original contract - do not remove or rename.
                "today_count": Appointment.objects.filter(appointment_date=today)
                .exclude(status__in=Appointment.SLOT_RELEASING_STATUSES)
                .count(),
                "by_status": by_status,
                "last_7_days": last_7_days,
                # Clinic software additions.
                "total_patients": active_patients.count(),
                "new_patients_this_month": active_patients.filter(
                    created_at__date__gte=month_start
                ).count(),
                "upcoming_count": Appointment.objects.filter(
                    appointment_date__gt=today, status__in=Appointment.OPEN_STATUSES
                ).count(),
                "needs_review_count": Appointment.objects.filter(
                    match_status=Appointment.MatchStatus.AMBIGUOUS
                ).count(),
                "open_visits_count": ClinicalVisit.objects.filter(
                    status=ClinicalVisit.Status.DRAFT
                ).count(),
                "visits_this_month": ClinicalVisit.objects.filter(
                    visit_date__gte=month_start
                ).count(),
            }
        )


class TodayQueueView(APIView):
    """Today's appointment queue, in the order patients will be seen."""

    permission_classes = [IsClinicStaff]

    def get(self, request):
        raw_date = request.query_params.get("date")
        try:
            target = date_cls.fromisoformat(raw_date) if raw_date else date_cls.today()
        except ValueError:
            target = date_cls.today()

        queryset = (
            Appointment.objects.select_related("patient")
            .filter(appointment_date=target)
            .order_by("appointment_time")
        )
        return Response(
            {
                "date": target.isoformat(),
                "appointments": AppointmentSerializer(
                    queryset, many=True, context={"request": request}
                ).data,
            }
        )


class UpcomingAppointmentsView(APIView):
    permission_classes = [IsClinicStaff]

    def get(self, request):
        today = date_cls.today()
        try:
            days = min(int(request.query_params.get("days", 7)), 60)
        except (TypeError, ValueError):
            days = 7
        queryset = (
            Appointment.objects.select_related("patient")
            .filter(
                appointment_date__gt=today,
                appointment_date__lte=today + timedelta(days=days),
                status__in=Appointment.OPEN_STATUSES,
            )
            .order_by("appointment_date", "appointment_time")[:50]
        )
        return Response(
            AppointmentSerializer(queryset, many=True, context={"request": request}).data
        )


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only by construction: the trail is never edited through the API."""

    queryset = AuditLog.objects.select_related("patient", "user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [CanViewAudit]
    pagination_class = AlwaysPageNumberPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        action_filter = params.get("action")
        if action_filter:
            queryset = queryset.filter(action=action_filter)
        model_filter = params.get("model")
        if model_filter:
            queryset = queryset.filter(model_name=model_filter)
        patient_uuid = params.get("patient")
        if patient_uuid:
            queryset = queryset.filter(patient__uuid=patient_uuid)
        username = params.get("username")
        if username:
            queryset = queryset.filter(username__icontains=username)
        date_from = params.get("date_from")
        if date_from:
            queryset = queryset.filter(timestamp__date__gte=date_from)
        date_to = params.get("date_to")
        if date_to:
            queryset = queryset.filter(timestamp__date__lte=date_to)
        search = (params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(object_repr__icontains=search) | Q(username__icontains=search)
            )
        return queryset


class CurrentStaffView(APIView):
    """Who am I and what may I do - drives which nav items the app renders."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = staff_profile_for(request.user)
        if profile is None:
            return Response(
                {"detail": "This account is not linked to an active clinic staff profile."},
                status=403,
            )
        data = StaffProfileSerializer(profile).data
        data["username"] = request.user.get_username()
        return Response(data)
