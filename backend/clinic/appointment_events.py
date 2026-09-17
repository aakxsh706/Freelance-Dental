"""Recording what happened to an appointment.

Every appointment event goes through `record_event` so the two stores can
never disagree:

  * AppointmentHistory - the timeline staff read on the appointment and on the
    patient's file. Typed columns, rendered directly.
  * AuditLog - the existing compliance trail across every model, with the
    acting user's IP and user agent.

They are not duplicates: one is a product feature, the other answers "who
touched this record" for every model in the system. Writing both from one
function is what stops them drifting apart, and means a call site records an
event once rather than remembering to write two rows.
"""


def _actor_name(user) -> str:
    if user is None or not getattr(user, "is_authenticated", False):
        return ""
    profile = getattr(user, "staff_profile", None)
    if profile is not None and profile.full_name:
        return profile.full_name
    return user.get_full_name() or user.get_username()


def record_event(
    appointment,
    *,
    event_type: str,
    request=None,
    user=None,
    reason: str = "",
    old_date=None,
    old_time=None,
    new_date=None,
    new_time=None,
    old_status: str = "",
    new_status: str = "",
    detail: dict | None = None,
):
    """Append one event to the appointment timeline and the audit trail.

    Never raises: a failure to record history must not undo the change the
    staff member actually made. The audit helper already swallows its own
    errors; the history write is guarded here for the same reason.
    """
    from .audit import record_audit
    from .models import AppointmentHistory

    if user is None and request is not None:
        candidate = getattr(request, "user", None)
        if candidate is not None and getattr(candidate, "is_authenticated", False):
            user = candidate

    entry = None
    try:
        entry = AppointmentHistory.objects.create(
            appointment=appointment,
            event_type=event_type,
            changed_by=user,
            changed_by_name=_actor_name(user),
            old_date=old_date,
            old_time=old_time,
            new_date=new_date,
            new_time=new_time,
            old_status=old_status or "",
            new_status=new_status or "",
            reason=reason or "",
            detail=detail or {},
        )
    except Exception:  # pragma: no cover - defensive
        import logging

        logging.getLogger(__name__).exception(
            "Could not write appointment history (event=%s, appointment=%s)",
            event_type,
            getattr(appointment, "pk", None),
        )

    changes = {"event": event_type}
    if reason:
        changes["reason"] = reason
    if old_status or new_status:
        changes["status"] = {"from": old_status, "to": new_status}
    if old_date or new_date:
        changes["scheduled"] = {
            "from": f"{old_date} {old_time}".strip(),
            "to": f"{new_date} {new_time}".strip(),
        }
    if detail:
        changes.update(detail)

    record_audit(
        request,
        action="update" if event_type != "created" else "create",
        instance=appointment,
        patient=appointment.patient,
        changes=changes,
        username=_actor_name(user),
    )
    return entry
