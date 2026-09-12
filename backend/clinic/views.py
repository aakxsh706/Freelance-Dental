from datetime import date as date_cls
from datetime import timedelta

from django.utils.dateparse import parse_date
from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .availability import compute_available_slots
from .models import Appointment, BlockedDate, ClinicSettings, Dentist, DentistAvailability
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentSerializer,
    AppointmentStatusUpdateSerializer,
    BlockedDateSerializer,
    ClinicSettingsSerializer,
    DentistAvailabilitySerializer,
    DentistSerializer,
)


class DentistProfileView(APIView):
    """Public: the single dentist's bio/profile for the About section."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        dentist = Dentist.objects.select_related("user").first()
        if not dentist:
            return Response(
                {"detail": "Dentist profile has not been configured yet."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(DentistSerializer(dentist).data)


class ClinicSettingsView(APIView):
    """Public: clinic name/phone/address/map used across the site and footer."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(ClinicSettingsSerializer(ClinicSettings.load()).data)


class AvailabilityView(APIView):
    """Public: available time slots for a given date.

    GET /api/availability/?date=YYYY-MM-DD
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        raw_date = request.query_params.get("date")
        if not raw_date:
            raise ValidationError({"date": "A date query parameter is required."})
        target_date = parse_date(raw_date)
        if not target_date:
            raise ValidationError({"date": "Date must be in YYYY-MM-DD format."})
        if target_date < date_cls.today():
            return Response({"date": raw_date, "slots": []})

        slots = compute_available_slots(target_date)
        return Response({"date": raw_date, "slots": slots})


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    - create: public (a patient booking an appointment)
    - list/retrieve/update/partial_update/destroy: dentist only
    """

    queryset = Appointment.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return AppointmentCreateSerializer
        if self.action == "partial_update":
            return AppointmentStatusUpdateSerializer
        return AppointmentSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        target_date = params.get("date")
        if target_date:
            queryset = queryset.filter(appointment_date=target_date)
        today_only = params.get("today")
        if today_only in ("1", "true", "True"):
            queryset = queryset.filter(appointment_date=date_cls.today())
        status_filter = params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment = serializer.save()
        output = AppointmentSerializer(appointment)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AppointmentSerializer(instance).data)


class DentistAvailabilityViewSet(viewsets.ModelViewSet):
    """Dentist-only management of recurring working hours."""

    queryset = DentistAvailability.objects.all()
    serializer_class = DentistAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]


class BlockedDateViewSet(viewsets.ModelViewSet):
    """Dentist-only management of holidays / unavailable dates."""

    queryset = BlockedDate.objects.all()
    serializer_class = BlockedDateSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]


class DashboardStatsView(APIView):
    """Dentist-only: lightweight counts used for the dashboard summary chart."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date_cls.today()
        by_status = {
            choice_value: Appointment.objects.filter(status=choice_value).count()
            for choice_value, _ in Appointment.Status.choices
        }

        last_7_days = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            count = Appointment.objects.filter(appointment_date=day).exclude(
                status=Appointment.Status.CANCELLED
            ).count()
            last_7_days.append({"date": day.isoformat(), "count": count})

        return Response(
            {
                "today_count": Appointment.objects.filter(appointment_date=today)
                .exclude(status=Appointment.Status.CANCELLED)
                .count(),
                "by_status": by_status,
                "last_7_days": last_7_days,
            }
        )
