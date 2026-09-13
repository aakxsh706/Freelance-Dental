"""Working hours and holidays. Unchanged behaviour, now role-gated."""

from rest_framework import viewsets

from ..models import BlockedDate, DentistAvailability
from ..permissions import CanManageSettings
from ..serializers import BlockedDateSerializer, DentistAvailabilitySerializer
from .mixins import AuditedModelMixin


class DentistAvailabilityViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Recurring working hours. Feeds the public availability calculation."""

    queryset = DentistAvailability.objects.all()
    serializer_class = DentistAvailabilitySerializer
    permission_classes = [CanManageSettings]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    audit_fields = ("day_of_week", "start_time", "end_time", "is_active")


class BlockedDateViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Holidays / unavailable dates. Also feeds availability."""

    queryset = BlockedDate.objects.all()
    serializer_class = BlockedDateSerializer
    permission_classes = [CanManageSettings]
    http_method_names = ["get", "post", "delete", "head", "options"]
    audit_fields = ("date", "reason")
