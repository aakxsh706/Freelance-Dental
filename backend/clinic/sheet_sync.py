"""Pushing patient contact details to a Google Sheet via a webhook.

The sheet is driven by an Apps Script web app bound to it (the script lives in
docs/patient_sheet_webhook.gs). The clinic POSTs rows to that URL; the script
writes them. That avoids a Google Cloud project, a service account and a key
file on the clinic's machine - the whole integration is one URL and one shared
token in backend/.env.

The clinic runs offline. A machine may go days without a connection, during
which patients are still registered and edited, so this cannot be a
fire-and-forget POST at the moment a record changes - that POST would simply
be lost.

Instead the sheet is treated as a projection of the database, brought up to
date whenever a connection happens to exist. Every run sends the full set of
active patients and the script reconciles by patient code:

  * a patient edited offline is updated in place rather than duplicated;
  * a run that finds nothing changed writes nothing;
  * a run interrupted halfway is corrected by the next one, because what is
    sent is recomputed from the database each time rather than read from a
    pointer into a queue.

Safe to run on a timer, on reconnect, or by hand, in any order, any number of
times.

Only contact details are sent. The patient record also holds date of birth,
address, emergency contacts and links to allergies, conditions and
medications; none of that leaves the clinic's own database, because a
spreadsheet is shared with a link and a link travels further than intended.
"""

from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger(__name__)

# The sheet's first row, and the order values are sent in. The Apps Script
# writes this header itself if the sheet is empty.
COLUMNS = ["Patient Code", "Name", "Phone", "Email", "City", "Registered"]

# A clinic machine on a slow connection should wait a little, but a scheduled
# run must not hang forever.
TIMEOUT_SECONDS = 30


class SheetSyncError(Exception):
    """Sync could not complete. Carries a message meant for clinic staff."""


class SheetOffline(SheetSyncError):
    """No usable connection. Expected, not a fault - try again later."""


@dataclass
class SyncResult:
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    total: int = 0

    @property
    def wrote_anything(self) -> bool:
        return bool(self.added or self.updated)

    def summary(self) -> str:
        noun = "patient" if self.total == 1 else "patients"
        return (
            f"{self.total} {noun}: {self.added} added, "
            f"{self.updated} updated, {self.unchanged} already current"
        )


def is_configured() -> bool:
    """True when the webhook URL and its token have both been set."""
    return bool(
        getattr(settings, "PATIENT_SHEET_WEBHOOK_URL", "")
        and getattr(settings, "PATIENT_SHEET_WEBHOOK_TOKEN", "")
    )


def _row_for(patient) -> list[str]:
    """Contact details only - see the module docstring."""
    return [
        patient.patient_code or "",
        patient.display_name or "",
        patient.phone or "",
        patient.email or "",
        patient.city or "",
        patient.created_at.strftime("%Y-%m-%d") if patient.created_at else "",
    ]


def desired_rows():
    """What the sheet should contain, newest registration last."""
    from .models import Patient

    patients = (
        Patient.objects.filter(is_active=True, merged_into__isnull=True)
        .order_by("created_at", "pk")
    )
    return [_row_for(p) for p in patients]


def _post(payload: dict) -> dict:
    """POST to the Apps Script web app and return its JSON reply."""
    url = settings.PATIENT_SHEET_WEBHOOK_URL
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            # Apps Script rejects requests without a recognisable agent.
            "User-Agent": "belin-clinic-sync/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        if exc.code in (401, 403):
            raise SheetSyncError(
                "The sheet's script rejected the token. Check "
                "PATIENT_SHEET_WEBHOOK_TOKEN in backend/.env matches the TOKEN "
                "in the Apps Script, then redeploy the script."
            ) from exc
        if exc.code == 404:
            raise SheetSyncError(
                "The webhook URL was not found. Re-copy the Web app URL from "
                "the Apps Script deployment and update PATIENT_SHEET_WEBHOOK_URL."
            ) from exc
        raise SheetSyncError(
            f"The sheet's script returned HTTP {exc.code}. {detail}"
        ) from exc
    except (urllib.error.URLError, socket.timeout, TimeoutError, OSError) as exc:
        # The ordinary offline case on a clinic machine.
        raise SheetOffline(
            "No internet connection - the sheet will be brought up to date "
            "the next time this runs while online."
        ) from exc

    try:
        reply = json.loads(raw)
    except json.JSONDecodeError as exc:
        # Almost always a sign-in page: the deployment's access is not set to
        # "Anyone", so Google served HTML instead of running the script.
        if "<html" in raw.lower() or "accounts.google.com" in raw.lower():
            raise SheetSyncError(
                "Google returned a sign-in page instead of running the script. "
                "In the Apps Script deployment set 'Who has access' to "
                "'Anyone', then redeploy and copy the new URL."
            ) from exc
        raise SheetSyncError(
            f"The sheet's script returned something unreadable: {raw[:200]}"
        ) from exc

    if not reply.get("ok"):
        raise SheetSyncError(
            f"The sheet's script reported: {reply.get('error', 'unknown error')}"
        )
    return reply


def sync(*, dry_run: bool = False) -> SyncResult:
    """Bring the sheet up to date with the database.

    Returns counts. Raises SheetOffline when there is simply no connection,
    which callers running on a timer should treat as routine.
    """
    if not is_configured():
        raise SheetSyncError(
            "Patient sheet sync is not configured. Set "
            "PATIENT_SHEET_WEBHOOK_URL and PATIENT_SHEET_WEBHOOK_TOKEN in "
            "backend/.env."
        )

    rows = desired_rows()
    result = SyncResult(total=len(rows))

    if dry_run:
        # Deliberately does not touch the network: the point of --dry-run on an
        # offline machine is to see what would be sent without needing a
        # connection to find out.
        result.added = len(rows)
        return result

    reply = _post(
        {
            "token": settings.PATIENT_SHEET_WEBHOOK_TOKEN,
            "columns": COLUMNS,
            "rows": rows,
        }
    )

    result.added = int(reply.get("added", 0))
    result.updated = int(reply.get("updated", 0))
    result.unchanged = int(reply.get("unchanged", 0))

    logger.info("Patient sheet sync: %s", result.summary())
    return result
