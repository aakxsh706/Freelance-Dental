"""Dentist availability computation.

Kept as a small standalone module (rather than inline in views/serializers)
so the rules for "what counts as an open slot" live in exactly one place:
working days/hours (DentistAvailability), holidays/leave (BlockedDate),
the configurable slot length (ClinicSettings), and existing bookings
(Appointment) can all change independently without touching this logic.

What counts as holding a slot is defined once, on the Appointment model
(SLOT_RELEASING_STATUSES, NON_RESERVING_SOURCES, slot_override). This module
and the database unique constraint both read the same rule, so "is this slot
free" cannot drift between what the screen shows and what the database will
accept.
"""

from datetime import date as date_cls
from datetime import datetime, timedelta

from .models import Appointment, BlockedDate, ClinicSettings, DentistAvailability


def _slot_reserving(queryset):
    """Narrow a queryset to appointments that actually reserve their slot.

    Mirrors the database's unique constraint exactly: active status, a source
    that books a slot, and not a deliberate override.
    """
    return queryset.exclude(
        status__in=Appointment.SLOT_RELEASING_STATUSES
    ).exclude(source__in=Appointment.NON_RESERVING_SOURCES).filter(slot_override=False)


def slot_conflicts(target_date: date_cls, target_time, exclude_pk=None):
    """Appointments already holding this exact slot.

    Returns a queryset rather than a boolean so callers can tell the user who
    they would be clashing with - "this slot is taken" is far less useful than
    "this slot is taken by Sarah Joseph, confirmed".
    """
    queryset = _slot_reserving(
        Appointment.objects.filter(
            appointment_date=target_date, appointment_time=target_time
        )
    )
    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)
    return queryset.select_related("patient")


def _time_windows_for_weekday(weekday: int):
    return DentistAvailability.objects.filter(day_of_week=weekday, is_active=True).order_by(
        "start_time"
    )


def get_blocked_reason(target_date: date_cls) -> str | None:
    blocked = BlockedDate.objects.filter(date=target_date).first()
    return blocked.reason or "Clinic closed" if blocked else None


def compute_available_slots(target_date: date_cls) -> list[dict]:
    """Return every slot for the day with its status: 'available' or 'booked'.

    Slots already in the past (when target_date is today) are omitted.
    """
    blocked_reason = get_blocked_reason(target_date)
    if blocked_reason:
        return []

    settings_obj = ClinicSettings.load()
    slot_minutes = settings_obj.slot_duration_minutes or 30
    windows = _time_windows_for_weekday(target_date.weekday())
    if not windows:
        return []

    booked_times = set(
        _slot_reserving(Appointment.objects.filter(appointment_date=target_date))
        .values_list("appointment_time", flat=True)
    )

    now = datetime.now()
    is_today = target_date == now.date()

    slots: list[dict] = []
    seen_times: set = set()
    for window in windows:
        cursor = datetime.combine(target_date, window.start_time)
        window_end = datetime.combine(target_date, window.end_time)
        step = timedelta(minutes=slot_minutes)
        while cursor + step <= window_end:
            slot_time = cursor.time()
            if slot_time in seen_times:
                cursor += step
                continue
            seen_times.add(slot_time)
            if is_today and cursor <= now:
                cursor += step
                continue
            status = "booked" if slot_time in booked_times else "available"
            slots.append({"time": slot_time.strftime("%H:%M"), "status": status})
            cursor += step

    return slots


def slot_is_available(target_date: date_cls, target_time, exclude_pk=None) -> bool:
    if get_blocked_reason(target_date):
        return False

    windows = _time_windows_for_weekday(target_date.weekday())
    within_hours = any(
        window.start_time <= target_time < window.end_time for window in windows
    )
    if not within_hours:
        return False

    return not slot_conflicts(target_date, target_time, exclude_pk=exclude_pk).exists()
