"""Shared view behaviour: pagination that stays backwards compatible, and
automatic audit writes.
"""

from rest_framework.pagination import PageNumberPagination

from ..audit import record_audit, summarize_changes


class OptInPageNumberPagination(PageNumberPagination):
    """Paginates only when the caller asks for a page.

    The original dashboard calls /api/appointments/ and expects a bare JSON
    array. Turning on pagination globally would wrap that in
    {count, next, previous, results} and break the deployed frontend, so
    pagination is opt-in per request: no `page` parameter, no envelope.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        if "page" not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)


class AlwaysPageNumberPagination(PageNumberPagination):
    """For endpoints introduced with the clinic software, which have no legacy
    callers and can be paginated unconditionally."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


def serialize_for_audit(instance, fields) -> dict:
    return {field: getattr(instance, field, None) for field in fields}


class AuditedModelMixin:
    """Records create/update/delete against a viewset's model.

    Sits on the viewset rather than on model signals so the acting user, their
    IP and the request are all available - an audit row that cannot say who
    made the change is not much of an audit row.

    `audit_fields` limits the diff to the columns worth tracking; leaving it
    empty records the action without a field-level diff.
    """

    audit_fields: tuple = ()

    def _audit_snapshot(self, instance) -> dict:
        if not self.audit_fields:
            return {}
        return serialize_for_audit(instance, self.audit_fields)

    def perform_create(self, serializer):
        instance = serializer.save()
        record_audit(
            self.request,
            action="create",
            instance=instance,
            changes=self._audit_snapshot(instance),
        )
        return instance

    def perform_update(self, serializer):
        before = self._audit_snapshot(serializer.instance)
        instance = serializer.save()
        after = self._audit_snapshot(instance)
        record_audit(
            self.request,
            action="update",
            instance=instance,
            changes=summarize_changes(before, after),
        )
        return instance

    def perform_destroy(self, instance):
        # Captured before deletion - afterwards there is nothing left to describe.
        record_audit(
            self.request,
            action="delete",
            instance=instance,
            model_name=instance.__class__.__name__,
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
        )
        instance.delete()
