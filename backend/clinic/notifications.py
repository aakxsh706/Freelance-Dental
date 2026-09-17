"""Patient emails about appointments.

Two rules shape this module.

**The appointment is authoritative; the email is a side effect.** Staff
confirming an appointment have made a decision about the clinic's day. If SMTP
is down, that decision still stands. Nothing here can roll back an appointment
change, so every entry point catches its own errors and reports them as a
delivery status rather than raising.

**What goes in an appointment email is administrative only** - who, when,
where, and how to reach the clinic. Never a diagnosis, clinical note,
prescription or medical history: email is unencrypted in transit to an address
that may be shared, and none of that is needed to tell someone their
appointment moved.
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.template.loader import render_to_string
from django.utils import timezone

from .models import AppointmentNotification, ClinicSettings

logger = logging.getLogger(__name__)

# Each entry is (template stem, subject stem). The stem resolves to both a
# .txt and a .html template; the plain-text part is the one that must always
# work, since some clients and most screen readers read it in preference.
TEMPLATES = {
    AppointmentNotification.Type.BOOKING_RECEIVED: (
        "booking_received",
        # Wording matters here: this is a receipt for a request, and must not
        # read as though the appointment is booked.
        "Appointment Request Received",
    ),
    AppointmentNotification.Type.CONFIRMATION: (
        "confirmation",
        "Your Appointment Is Confirmed",
    ),
    AppointmentNotification.Type.RESCHEDULE: (
        "reschedule",
        "Your Appointment Has Been Rescheduled",
    ),
    AppointmentNotification.Type.CANCELLATION: (
        "cancellation",
        "Your Appointment Has Been Cancelled",
    ),
    AppointmentNotification.Type.REQUEST_DECLINED: (
        "request_declined",
        # Never "rejected" - the patient did nothing wrong, the slot was simply
        # not available.
        "Update About Your Appointment Request",
    ),
}


def _format_date(value) -> str:
    return value.strftime("%d %B %Y") if value else ""


def _format_time(value) -> str:
    if not value:
        return ""
    hour = value.hour % 12 or 12
    period = "AM" if value.hour < 12 else "PM"
    return f"{hour}:{value.minute:02d} {period}"


def _first_name(appointment) -> str:
    if appointment.patient and appointment.patient.first_name:
        return appointment.patient.first_name
    return (appointment.patient_name or "there").split(" ")[0]


def recipient_for(appointment) -> str:
    """Where to write.

    The address typed on the appointment wins over the one on the patient
    record: someone booking for a relative, or who has since changed address,
    told us on this booking where to reach them about this booking.
    """
    if appointment.email:
        return appointment.email
    if appointment.patient and appointment.patient.email:
        return appointment.patient.email
    return ""


def build_context(appointment, context_extra: dict | None = None) -> dict:
    """Everything an appointment email may reference.

    Date and time are read from the appointment as it stands *now*, never from
    values captured earlier: staff routinely move a request before approving
    it, and an email confirming the time the patient originally asked for
    rather than the one they were actually given is the worst possible bug in
    this feature.

    Clinic details come from ClinicSettings, so changing the phone number in
    one place changes it in every email.
    """
    context = {
        "clinic": ClinicSettings.load(),
        "first_name": _first_name(appointment),
        "patient_name": appointment.patient_name,
        "appointment_date": _format_date(appointment.appointment_date),
        "appointment_time": _format_time(appointment.appointment_time),
        "requested_date": _format_date(appointment.requested_date),
        "requested_time": _format_time(appointment.requested_time),
        "moved_before_confirming": appointment.was_moved_before_confirming,
    }
    context.update(context_extra or {})
    return context


def build_message(appointment, notification_type: str, context_extra: dict | None = None):
    """Render subject and plain-text body. Returns (subject, body)."""
    stem, subject_stem = TEMPLATES[notification_type]
    clinic = ClinicSettings.load()
    context = build_context(appointment, context_extra)
    # using="text" selects the non-autoescaping engine - see settings.TEMPLATES.
    body = render_to_string(f"clinic/email/{stem}.txt", context, using="text")
    # Templates use {% if %} blocks for optional clinic details, which leaves
    # ragged blank lines; collapse runs of them so the email reads cleanly.
    lines = [line.rstrip() for line in body.splitlines()]
    cleaned: list[str] = []
    for line in lines:
        if not line and cleaned and not cleaned[-1]:
            continue
        cleaned.append(line)
    return f"{subject_stem} - {clinic.clinic_name}", "\n".join(cleaned).strip() + "\n"


def queue_notification(
    appointment, notification_type: str, *, dedupe_key: str, context_extra: dict | None = None
):
    """Record that this email is owed, inside the caller's transaction.

    Returns (notification, created). A repeat call with the same dedupe_key
    returns the existing row and created=False, which is what makes confirming
    twice send one email rather than two.
    """
    recipient = recipient_for(appointment)
    try:
        subject, _ = build_message(appointment, notification_type, context_extra)
    except Exception:  # pragma: no cover - template errors must not block the change
        logger.exception("Could not render %s email subject", notification_type)
        subject = ""

    try:
        with transaction.atomic():
            notification = AppointmentNotification.objects.create(
                appointment=appointment,
                notification_type=notification_type,
                recipient_email=recipient,
                subject=subject,
                dedupe_key=dedupe_key,
                # No address is not a failure - there is simply nobody to write
                # to. Recorded as skipped so it is visible rather than silent.
                status=(
                    AppointmentNotification.Status.PENDING
                    if recipient
                    else AppointmentNotification.Status.SKIPPED
                ),
                failure_reason="" if recipient else "No email address on file for this patient.",
            )
            return notification, True
    except IntegrityError:
        existing = AppointmentNotification.objects.filter(
            appointment=appointment, dedupe_key=dedupe_key
        ).first()
        return existing, False


def deliver(notification, context_extra: dict | None = None) -> bool:
    """Attempt delivery. Returns True if sent. Never raises.

    Call this *after* the transaction carrying the appointment change has
    committed. Sending from inside the transaction risks emailing a patient
    about a change that then rolls back.
    """
    if notification is None:
        return False
    if notification.status == AppointmentNotification.Status.SENT:
        return True
    if notification.status == AppointmentNotification.Status.SKIPPED:
        return False

    appointment = notification.appointment
    try:
        subject, body = build_message(
            appointment, notification.notification_type, context_extra
        )
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[notification.recipient_email],
        )
        # HTML is an alternative, never the only version. If it fails to render
        # the patient still gets a readable email rather than nothing.
        stem, _ = TEMPLATES[notification.notification_type]
        try:
            message.attach_alternative(
                render_to_string(
                    f"clinic/email/{stem}.html",
                    build_context(appointment, context_extra),
                ),
                "text/html",
            )
        except Exception:
            logger.exception("HTML part failed to render for %s; sending text only", stem)
        message.send(fail_silently=False)
    except Exception as exc:
        notification.status = AppointmentNotification.Status.FAILED
        # Bounded: an SMTP traceback can be enormous and this column is read by
        # staff, not by a debugger.
        notification.failure_reason = f"{exc.__class__.__name__}: {exc}"[:500]
        notification.attempts += 1
        notification.save(
            update_fields=["status", "failure_reason", "attempts", "updated_at"]
        )
        logger.warning(
            "Appointment email failed (type=%s, appointment=%s): %s",
            notification.notification_type,
            appointment.pk,
            exc,
        )
        return False

    notification.status = AppointmentNotification.Status.SENT
    notification.sent_at = timezone.now()
    notification.subject = subject
    notification.failure_reason = ""
    notification.attempts += 1
    notification.save(
        update_fields=["status", "sent_at", "subject", "failure_reason", "attempts", "updated_at"]
    )
    return True


def notify(appointment, notification_type: str, *, dedupe_key: str, context_extra=None):
    """Queue then deliver, returning the notification row for the API response.

    The row is the honest answer to "did the patient hear about this": `sent`,
    `failed` with a reason, or `skipped` when there is no address.
    """
    notification, created = queue_notification(
        appointment, notification_type, dedupe_key=dedupe_key, context_extra=context_extra
    )
    if notification is None:
        return None
    if not created and notification.status == AppointmentNotification.Status.SENT:
        return notification
    deliver(notification, context_extra)
    notification.refresh_from_db()
    return notification
