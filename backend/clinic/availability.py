"""Dentist availability computation.

Kept as a small standalone module (rather than inline in views/serializers)
so the rules for "what counts as an open slot" live in exactly one place:
working days/hours (DentistAvailability), holidays/leave (BlockedDate),
the configurable slot length (ClinicSettings), and existing bookings
(Appointment) can all change independently without touching this logic.

Which statuses still hold a slot is defined once, on the Appointment model, as
SLOT_RELEASING_STATUSES. This module and the database unique constraint both
read it, so "is this slot free" cannot drift between the two.
"""

from datetime import date as date_cls
from datetime import datetime, timedelta

from .models import Appointment, BlockedDate, ClinicSettings, DentistAvailability


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
        Appointment.objects.filter(appointment_date=target_date)
        .exclude(status__in=Appointment.SLOT_RELEASING_STATUSES)
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


def slot_is_available(target_date: date_cls, target_time) -> bool:
    if get_blocked_reason(target_date):
        return False

    windows = _time_windows_for_weekday(target_date.weekday())
    within_hours = any(
        window.start_time <= target_time < window.end_time for window in windows
    )
    if not within_hours:
        return False

    already_booked = (
        Appointment.objects.filter(appointment_date=target_date, appointment_time=target_time)
        .exclude(status__in=Appointment.SLOT_RELEASING_STATUSES)
        .exists()
    )
    return not already_booked
