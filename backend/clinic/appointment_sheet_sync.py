"""Turning booking-sheet rows into Appointments.

This is the shared core used by the appointment sheet poller
(appointment_sheet_poll.py): given a batch of plain dicts, one per sheet row,
create an Appointment for each row not already imported, and report what
happened to each one.

Previously this logic lived inside AppointmentSheetWebhookView, an inbound
push endpoint. That endpoint has been removed - the clinic PC runs offline
behind a home/office router with no port forwarding and no public IP, so a
push from Google's own servers (where Apps Script's UrlFetchApp.fetch() runs)
could never reach it in the real deployment, only in a same-machine test. The
validation/creation logic below is unchanged from that endpoint; only who
calls it changed.

A batch may contain any number of rows, and one bad row must not cost the
others their appointment - so each row gets its own transaction and its own
reported outcome.
"""

from __future__ import annotations

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Appointment
from .serializers import AppointmentCreateSerializer


def import_rows(rows: list[dict]) -> list[dict]:
    """Create an Appointment for each row not already imported.

    Returns one result dict per row, in the same order, each shaped
    {"row_id": ..., "result": "created"|"duplicate"|"error", ...}.
    """
    return [_import_row(row) for row in rows]


def _import_row(row: dict) -> dict:
    row_id = str(row.get("row_id", ""))

    if not row_id:
        return {"row_id": row_id, "result": "error", "detail": "Missing row_id."}

    if Appointment.objects.filter(external_reference=row_id).exists():
        # Already imported on an earlier poll. The sheet's doGet script
        # returns every row with a Sync ID on every call regardless of past
        # status (see docs/appointment_sheet_poll.gs) rather than tracking
        # what it has already sent, precisely because this dedup check makes
        # that cheap and safe - a re-seen row is the ordinary, expected case
        # rather than a fault.
        return {"row_id": row_id, "result": "duplicate"}

    try:
        with transaction.atomic():
            # Reused exactly as the old public booking endpoint used it: date
            # validation, slot-availability checking and patient matching all
            # come from here, unchanged.
            serializer = AppointmentCreateSerializer(
                data={
                    "patient_name": row.get("patient_name", ""),
                    "phone": row.get("phone", ""),
                    "email": row.get("email", ""),
                    "reason": row.get("reason", ""),
                    "notes": row.get("notes", ""),
                    "appointment_date": row.get("appointment_date", ""),
                    "appointment_time": row.get("appointment_time", ""),
                }
            )
            if not serializer.is_valid():
                return {
                    "row_id": row_id,
                    "result": "error",
                    "detail": serializer.errors,
                }
            appointment = serializer.save()
            appointment.external_reference = row_id
            appointment.save(update_fields=["external_reference"])
    except ValidationError as exc:
        # Raised by AppointmentCreateSerializer.create() itself when the slot
        # was taken between validate() and save() - still a per-row
        # validation failure, not a server error.
        return {"row_id": row_id, "result": "error", "detail": exc.detail}
    except Exception as exc:  # noqa: BLE001 - one bad row must not sink the batch
        return {"row_id": row_id, "result": "error", "detail": str(exc)}

    return {
        "row_id": row_id,
        "result": "created",
        "appointment_id": appointment.id,
    }
