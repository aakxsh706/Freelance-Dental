"""Writing the audit trail.

Audit rows are written in the request path, so a failure here must never take
down the operation being audited - a patient record that cannot be saved
because logging broke is a worse outcome than a gap in the log. Every entry
point swallows and reports its own errors for that reason.
"""

import logging

from .models import AuditLog

logger = logging.getLogger(__name__)

# Values that must never be copied into the audit trail. The log is read by
# more people than the records it describes, so it stores what changed, not
# the contents of sensitive fields.
REDACTED_FIELDS = {"password", "token", "access", "refresh"}


def client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _user_agent(request) -> str:
    if request is None:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:300]


def summarize_changes(before: dict | None, after: dict | None) -> dict:
    """Field-level diff, with sensitive values redacted.

    Stores only the names and new values of fields that actually changed;
    an unchanged field is noise in a trail people have to read.
    """
    before = before or {}
    after = after or {}
    changes = {}
    for key, new_value in after.items():
        if key in REDACTED_FIELDS:
            changes[key] = "[redacted]"
            continue
        old_value = before.get(key)
        if old_value != new_value:
            changes[key] = {"from": _stringify(old_value), "to": _stringify(new_value)}
    return changes


def _stringify(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def record_audit(
    request=None,
    *,
    action: str,
    instance=None,
    model_name: str = "",
    object_id: str = "",
    object_repr: str = "",
    patient=None,
    changes: dict | None = None,
    username: str = "",
) -> AuditLog | None:
    """Append one entry. Never raises."""
    try:
        user = getattr(request, "user", None)
        if user is not None and not getattr(user, "is_authenticated", False):
            user = None

        if instance is not None:
            model_name = model_name or instance.__class__.__name__
            object_id = object_id or str(getattr(instance, "pk", ""))
            object_repr = object_repr or str(instance)[:255]
            if patient is None:
                patient = _patient_of(instance)

        return AuditLog.objects.create(
            user=user,
            username=username or (user.get_username() if user else ""),
            action=action,
            model_name=model_name,
            object_id=str(object_id)[:64],
            object_repr=object_repr[:255],
            patient=patient,
            changes=changes or {},
            ip_address=client_ip(request),
            user_agent=_user_agent(request),
        )
    except Exception:
        logger.exception("Failed to write audit log entry (action=%s)", action)
        return None


def _patient_of(instance):
    """Best-effort: which patient does this record concern?

    Lets the trail answer "who accessed this patient's file" without every
    call site having to pass the patient explicitly.
    """
    from .models import Patient

    if isinstance(instance, Patient):
        return instance
    return getattr(instance, "patient", None)
