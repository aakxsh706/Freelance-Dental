"""Endpoints the public website calls. Unauthenticated by design.

Kept in their own module so it stays obvious which surface is exposed to the
internet: anything not in here requires a staff login.
"""

from datetime import date as date_cls

from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from ..audit import record_audit
from ..availability import compute_available_slots
from ..models import ClinicSettings, Dentist
from ..permissions import ensure_staff_profile
from ..serializers import ClinicSettingsSerializer, DentistSerializer


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
    """Public read of clinic name/phone/address/map, staff write.

    One endpoint rather than two: the website footer and the clinic settings
    screen are looking at the same row, and splitting them would invite the
    two copies to drift.
    """

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        from ..permissions import CanManageSettings

        return [permissions.IsAuthenticated(), CanManageSettings()]

    def get(self, request):
        return Response(ClinicSettingsSerializer(ClinicSettings.load()).data)

    def patch(self, request):
        settings_obj = ClinicSettings.load()
        serializer = ClinicSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(
            request,
            action="update",
            instance=settings_obj,
            changes={k: str(v) for k, v in serializer.validated_data.items()},
        )
        return Response(serializer.data)


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


class AuditedTokenObtainPairView(TokenObtainPairView):
    """Login, with both outcomes recorded.

    Failed attempts are logged deliberately: repeated failures against a
    clinical system are the signal you most want in the trail, and they are
    invisible if only successes are recorded. The password is never touched -
    only the attempted username.
    """

    def post(self, request, *args, **kwargs):
        username = str(request.data.get("username", ""))[:150]
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = self._user_for(username)
            if user is not None:
                ensure_staff_profile(user)
            record_audit(
                request,
                action="login",
                model_name="User",
                object_repr=username,
                username=username,
            )
        return response

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if getattr(response, "status_code", None) == 401:
            record_audit(
                self.request,
                action="login_failed",
                model_name="User",
                object_repr=str(self.request.data.get("username", ""))[:150],
                username=str(self.request.data.get("username", ""))[:150],
            )
        return response

    @staticmethod
    def _user_for(username: str):
        from django.contrib.auth import get_user_model

        return get_user_model().objects.filter(username=username).first()
