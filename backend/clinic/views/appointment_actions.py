"""The appointment workflow actions, mixed into AppointmentViewSet.

Each action follows the same shape, and the order matters:

    1. validate
    2. change the database inside one transaction
    3. commit
    4. attempt the email
    5. report both outcomes

The email is deliberately outside the transaction. Sending inside it risks
telling a patient their appointment moved and then rolling the move back; and
a failure to send must never undo a change the clinic has already made. So the
response carries two separate facts - what the database did, and what the
email did - and the interface shows both.
"""

import logging
from datetime import datetime

from django.db import transaction
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..appointment_events import record_event
from ..identifiers import create_with_patient_code
from ..matching import find_patient_matches
from ..models import Appointment, AppointmentHistory, AppointmentNotification, Patient
from ..notifications import notify
from ..permissions import can_override_slot
from ..serializers import (
    AppointmentHistorySerializer,
    AppointmentNotificationSerializer,
    AppointmentSerializer,
    CancelAppointmentSerializer,
    CheckInSerializer,
    ConfirmAppointmentSerializer,
    ConflictingAppointmentSerializer,
    EditAppointmentSerializer,
    RescheduleAppointmentSerializer,
    SlotConflict,
    WalkInSerializer,
)

logger = logging.getLogger(__name__)


def notification_payload(notification):
    """The email outcome, shaped for the interface.

    Always present in an action's response, never an exception, so the frontend
    can say "saved, but we could not email them" rather than implying the whole
    operation failed.

    `delivered` is deliberately separate from `status`. With a console or
    in-memory backend Django reports a successful send for a message that was
    printed and thrown away; reporting that to staff as "email sent" is how a
    clinic ends up believing a patient was told something they were not.
    """
    from ..notifications import delivery_is_real

    real = delivery_is_real()
    if notification is None:
        return {
            "attempted": False,
            "status": "not_sent",
            "detail": "",
            "delivered": False,
            "delivery_configured": real,
        }
    return {
        "attempted": notification.status != AppointmentNotification.Status.SKIPPED,
        "status": notification.status,
        "recipient": notification.recipient_email,
        "detail": notification.failure_reason,
        "sent_at": notification.sent_at,
        "delivered": real and notification.status == AppointmentNotification.Status.SENT,
        "delivery_configured": real,
    }


class AppointmentActionsMixin:
    """Workflow endpoints for a single appointment."""

    def _appointment(self):
        return self.get_object()

    def _respond(self, appointment, notification=None, extra=None):
        appointment.refresh_from_db()
        body = {
            "appointment": AppointmentSerializer(
                appointment, context=self.get_serializer_context()
            ).data,
            "notification": notification_payload(notification),
        }
        if extra:
            body.update(extra)
        return Response(body)

    @staticmethod
    def _conflict_response(conflict):
        """409 carrying the clashing appointment.

        Not a 400: the request was well-formed, the slot is simply taken. The
        body names who is in it so staff can choose another time or override.
        """
        return Response(
            {
                "detail": "This time slot is already occupied.",
                "conflict": ConflictingAppointmentSerializer(conflict).data,
                "can_override": None,
            },
            status=http_status.HTTP_409_CONFLICT,
        )

    # --- Accept / confirm --------------------------------------------------

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Staff accept a pending booking. Public callers can never reach this."""
        appointment = self._appointment()
        serializer = ConfirmAppointmentSerializer(
            data=request.data, context={"appointment": appointment, "request": request}
        )
        serializer.is_valid(raise_exception=True)

        previous_status = appointment.status
        with transaction.atomic():
            appointment.status = Appointment.Status.CONFIRMED
            appointment.confirmed_at = timezone.now()
            appointment.confirmed_by = request.user
            appointment.save(
                update_fields=["status", "confirmed_at", "confirmed_by", "updated_at"]
            )
            record_event(
                appointment,
                event_type=AppointmentHistory.Event.CONFIRMED,
                request=request,
                old_status=previous_status,
                new_status=appointment.status,
            )

        # Committed. The appointment is confirmed whatever happens next.
        notification = None
        if serializer.validated_data.get("notify", True):
            notification = notify(
                appointment,
                AppointmentNotification.Type.CONFIRMATION,
                dedupe_key="confirmation",
            )
        return self._respond(appointment, notification)

    # --- Reschedule --------------------------------------------------------

    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        appointment = self._appointment()
        serializer = RescheduleAppointmentSerializer(
            data=request.data, context={"appointment": appointment, "request": request}
        )
        try:
            serializer.is_valid(raise_exception=True)
        except SlotConflict as conflict:
            body = self._conflict_response(conflict.conflicting)
            body.data["can_override"] = can_override_slot(request.user)
            return body

        data = serializer.validated_data
        conflict = data.get("_conflict")
        if conflict is not None and not can_override_slot(request.user):
            return Response(
                {
                    "detail": (
                        "You do not have permission to book over an existing appointment. "
                        "Ask a dentist or administrator, or choose another time."
                    ),
                    "conflict": ConflictingAppointmentSerializer(conflict).data,
                    "can_override": False,
                },
                status=http_status.HTTP_403_FORBIDDEN,
            )

        old_date = appointment.appointment_date
        old_time = appointment.appointment_time

        with transaction.atomic():
            appointment.appointment_date = data["appointment_date"]
            appointment.appointment_time = data["appointment_time"]
            fields = ["appointment_date", "appointment_time", "updated_at"]
            if conflict is not None:
                appointment.slot_override = True
                appointment.slot_override_reason = data.get("override_reason", "")
                fields += ["slot_override", "slot_override_reason"]
            appointment.save(update_fields=fields)

            record_event(
                appointment,
                event_type=AppointmentHistory.Event.RESCHEDULED,
                request=request,
                reason=data["reason"],
                old_date=old_date,
                old_time=old_time,
                new_date=appointment.appointment_date,
                new_time=appointment.appointment_time,
            )
            if conflict is not None:
                record_event(
                    appointment,
                    event_type=AppointmentHistory.Event.SLOT_OVERRIDE,
                    request=request,
                    reason=data.get("override_reason", ""),
                    detail={
                        "conflicting_appointment_id": conflict.pk,
                        "conflicting_patient": conflict.patient_name,
                    },
                )

        notification = None
        if data.get("notify", True):
            notification = notify(
                appointment,
                AppointmentNotification.Type.RESCHEDULE,
                # Keyed to this specific move, so re-sending the same reschedule
                # is idempotent while a second, different move still emails.
                dedupe_key=f"reschedule:{old_date}:{old_time}"
                f"->{appointment.appointment_date}:{appointment.appointment_time}",
                context_extra={
                    "previous_date": old_date.strftime("%d %B %Y"),
                    "previous_time": _format_time(old_time),
                },
            )
        return self._respond(appointment, notification)

    # --- Edit --------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None):
        """Administrative edits: reason, notes, contact details, and the schedule."""
        appointment = self._appointment()
        serializer = EditAppointmentSerializer(
            data=request.data, context={"appointment": appointment, "request": request}
        )
        try:
            serializer.is_valid(raise_exception=True)
        except SlotConflict as conflict:
            body = self._conflict_response(conflict.conflicting)
            body.data["can_override"] = can_override_slot(request.user)
            return body

        data = serializer.validated_data
        conflict = data.get("_conflict")
        if conflict is not None and not can_override_slot(request.user):
            return Response(
                {
                    "detail": "You do not have permission to book over an existing appointment.",
                    "conflict": ConflictingAppointmentSerializer(conflict).data,
                    "can_override": False,
                },
                status=http_status.HTTP_403_FORBIDDEN,
            )

        old_date, old_time = appointment.appointment_date, appointment.appointment_time
        editable = ["reason", "notes", "phone", "email", "appointment_date", "appointment_time"]
        changed = []

        with transaction.atomic():
            for field in editable:
                if field in data and getattr(appointment, field) != data[field]:
                    setattr(appointment, field, data[field])
                    changed.append(field)
            if conflict is not None:
                appointment.slot_override = True
                appointment.slot_override_reason = data.get("override_reason", "")
                changed += ["slot_override", "slot_override_reason"]
            if changed:
                appointment.save(update_fields=changed + ["updated_at"])

            if changed:
                moved = data.get("_moved")
                record_event(
                    appointment,
                    # A date/time change is a reschedule however it was reached,
                    # so it lands in the timeline as one and the patient is told.
                    event_type=(
                        AppointmentHistory.Event.RESCHEDULED
                        if moved
                        else AppointmentHistory.Event.EDITED
                    ),
                    request=request,
                    reason=data.get("change_reason", ""),
                    old_date=old_date if moved else None,
                    old_time=old_time if moved else None,
                    new_date=appointment.appointment_date if moved else None,
                    new_time=appointment.appointment_time if moved else None,
                    detail={"fields": [f for f in changed if not f.startswith("slot_")]},
                )

        notification = None
        if data.get("_moved") and data.get("notify", True):
            notification = notify(
                appointment,
                AppointmentNotification.Type.RESCHEDULE,
                dedupe_key=f"reschedule:{old_date}:{old_time}"
                f"->{appointment.appointment_date}:{appointment.appointment_time}",
                context_extra={
                    "previous_date": old_date.strftime("%d %B %Y"),
                    "previous_time": _format_time(old_time),
                },
            )
        return self._respond(appointment, notification, {"changed_fields": changed})

    # --- Check in ----------------------------------------------------------

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        """Record that the patient arrived.

        Sets checked_in_at only. The scheduled time is never touched: someone
        booked at 10:30 who arrives at 11:15 still had a 10:30 appointment, and
        overwriting it would erase the fact that they were 45 minutes late.
        """
        appointment = self._appointment()
        serializer = CheckInSerializer(
            data=request.data, context={"appointment": appointment, "request": request}
        )
        serializer.is_valid(raise_exception=True)

        arrived_at = serializer.validated_data.get("arrived_at") or timezone.now()
        previous_status = appointment.status
        correcting = appointment.checked_in_at is not None

        with transaction.atomic():
            previous_arrival = appointment.checked_in_at
            appointment.checked_in_at = arrived_at
            appointment.checked_in_by = request.user
            fields = ["checked_in_at", "checked_in_by", "updated_at"]
            if appointment.status != Appointment.Status.CHECKED_IN:
                appointment.status = Appointment.Status.CHECKED_IN
                fields.append("status")
            appointment.save(update_fields=fields)

            record_event(
                appointment,
                event_type=(
                    AppointmentHistory.Event.ARRIVAL_CORRECTED
                    if correcting
                    else AppointmentHistory.Event.CHECKED_IN
                ),
                request=request,
                old_status="" if correcting else previous_status,
                new_status="" if correcting else appointment.status,
                detail={
                    "arrived_at": arrived_at.isoformat(),
                    "scheduled_for": f"{appointment.appointment_date} {appointment.appointment_time}",
                    **(
                        {"previous_arrival": previous_arrival.isoformat()}
                        if previous_arrival
                        else {}
                    ),
                },
            )
        # Check-in is an internal event; the patient is standing at the desk.
        return self._respond(appointment)

    # --- Cancel ------------------------------------------------------------

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel without deleting. The row stays, and stays in the history."""
        appointment = self._appointment()
        serializer = CancelAppointmentSerializer(
            data=request.data, context={"appointment": appointment, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        previous_status = appointment.status
        with transaction.atomic():
            appointment.status = Appointment.Status.CANCELLED
            appointment.cancelled_at = timezone.now()
            appointment.cancellation_reason = data.get("reason", "")
            appointment.save(
                update_fields=[
                    "status",
                    "cancelled_at",
                    "cancellation_reason",
                    "updated_at",
                ]
            )
            record_event(
                appointment,
                event_type=AppointmentHistory.Event.CANCELLED,
                request=request,
                reason=data.get("reason", ""),
                old_status=previous_status,
                new_status=appointment.status,
            )

        notification = None
        if data.get("notify", True):
            # Two different messages for two different situations. Someone who
            # was expecting to come in is being cancelled on. Someone whose
            # request was never accepted is being told we could not fit them -
            # telling them their "appointment was cancelled" would imply they
            # had one, and reads as a rebuke for something they did not do.
            declining_request = previous_status == Appointment.Status.PENDING
            notification = notify(
                appointment,
                (
                    AppointmentNotification.Type.REQUEST_DECLINED
                    if declining_request
                    else AppointmentNotification.Type.CANCELLATION
                ),
                dedupe_key="request_declined" if declining_request else "cancellation",
                context_extra={"reason": data.get("reason", "")},
            )
        return self._respond(appointment, notification)

    # --- History and notifications ----------------------------------------

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        from ..notifications import delivery_is_real

        appointment = self._appointment()
        return Response(
            {
                "history": AppointmentHistorySerializer(
                    appointment.history.all(), many=True
                ).data,
                "notifications": AppointmentNotificationSerializer(
                    appointment.notifications.all(), many=True
                ).data,
                # A row stored as "sent" only means Django accepted it. With a
                # console backend that message was printed and discarded, and a
                # log of green "Sent" badges for mail nobody received is worse
                # than no log at all.
                "delivery_configured": delivery_is_real(),
            }
        )

    @action(detail=True, methods=["post"], url_path="resend-notification")
    def resend_notification(self, request, pk=None):
        """Retry a failed email without changing the appointment."""
        from ..notifications import deliver

        appointment = self._appointment()
        notification = appointment.notifications.filter(
            status__in=[
                AppointmentNotification.Status.FAILED,
                AppointmentNotification.Status.PENDING,
            ]
        ).first()
        if notification is None:
            return Response(
                {"detail": "There is no failed notification to resend."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        deliver(notification)
        notification.refresh_from_db()
        return self._respond(appointment, notification)


def _format_time(value) -> str:
    hour = value.hour % 12 or 12
    period = "AM" if value.hour < 12 else "PM"
    return f"{hour}:{value.minute:02d} {period}"


class WalkInMixin:
    """Registering an unscheduled arrival."""

    @action(detail=False, methods=["post"], url_path="walk-in")
    def walk_in(self, request):
        serializer = WalkInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        arrived_at = data.get("arrived_at") or timezone.now()
        local_arrival = timezone.localtime(arrived_at)

        with transaction.atomic():
            patient = data.get("patient")
            created_patient = False
            if patient is None:
                # Reception chose to create rather than select. The matcher is
                # not run to auto-link here: the person is standing at the desk
                # and reception has already searched and decided this is
                # somebody new. Guessing now would be how duplicates are made.
                patient = create_with_patient_code(
                    Patient,
                    first_name=(data.get("first_name") or "").strip(),
                    last_name=(data.get("last_name") or "").strip(),
                    phone=data.get("phone", ""),
                    email=data.get("email", ""),
                    date_of_birth=data.get("date_of_birth"),
                    gender=data.get("gender", ""),
                )
                created_patient = True

            appointment = Appointment.objects.create(
                patient=patient,
                patient_name=patient.full_name,
                phone=data.get("phone") or patient.phone,
                email=data.get("email") or patient.email,
                reason=data["reason"],
                notes=data.get("notes", ""),
                # The scheduled time of a walk-in is the moment they arrived.
                appointment_date=local_arrival.date(),
                appointment_time=local_arrival.time().replace(microsecond=0),
                status=Appointment.Status.CHECKED_IN,
                source=Appointment.Source.WALK_IN,
                match_status=Appointment.MatchStatus.LINKED,
                checked_in_at=arrived_at,
                checked_in_by=request.user,
                created_by=request.user,
            )
            record_event(
                appointment,
                event_type=AppointmentHistory.Event.CREATED,
                request=request,
                new_status=appointment.status,
                detail={
                    "source": Appointment.Source.WALK_IN,
                    "patient_created": created_patient,
                    "arrived_at": arrived_at.isoformat(),
                },
            )
            record_event(
                appointment,
                event_type=AppointmentHistory.Event.CHECKED_IN,
                request=request,
                detail={"arrived_at": arrived_at.isoformat()},
            )

        return Response(
            {
                "appointment": AppointmentSerializer(
                    appointment, context=self.get_serializer_context()
                ).data,
                "patient_created": created_patient,
                "notification": notification_payload(None),
            },
            status=http_status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="walk-in/search")
    def walk_in_search(self, request):
        """Patient lookup for the walk-in form, with duplicate warnings.

        Returns likely matches on phone/email separately from the text search,
        so reception sees "this number already belongs to someone" before
        creating a second record for a patient who is already on file.
        """
        from ..serializers import PatientListSerializer

        term = (request.query_params.get("search") or "").strip()
        phone = (request.query_params.get("phone") or "").strip()
        email = (request.query_params.get("email") or "").strip()

        results = Patient.objects.none()
        if term:
            from django.db.models import Q

            from ..matching import normalize_phone

            criteria = (
                Q(first_name__icontains=term)
                | Q(last_name__icontains=term)
                | Q(display_name__icontains=term)
                | Q(patient_code__icontains=term)
                | Q(phone__icontains=term)
                | Q(email__icontains=term)
            )
            digits = normalize_phone(term)
            if digits:
                criteria |= Q(phone_normalized=digits)
            results = Patient.objects.filter(
                criteria, is_active=True, merged_into__isnull=True
            )[:10]

        likely = []
        if phone or email:
            match = find_patient_matches("", phone, email)
            likely = match.candidates

        context = self.get_serializer_context()
        return Response(
            {
                "results": PatientListSerializer(results, many=True, context=context).data,
                "likely_existing": PatientListSerializer(
                    likely, many=True, context=context
                ).data,
            }
        )
