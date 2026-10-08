"""Pulling new appointment-sheet rows from Google - the receiving end of the
appointment sheet sync (the reverse direction of sheet_sync.py).

Why this is a PULL and not a push: this app runs as an offline Windows .exe
on a clinic PC behind a home/office router - no port forwarding, no public
IP. An earlier version of this feature had Apps Script POST new rows to a
Django webhook, which tested fine because both the fake "Apps Script" curl
and Django were run on the same localhost machine - but Apps Script's
UrlFetchApp.fetch() actually runs on GOOGLE'S servers, which can never reach
127.0.0.1 on a NAT'd PC. That push could never have arrived in the real
deployment.

The clinic PC, on the other hand, already makes working *outbound* calls to
Google - see sheet_sync.py, the one-way patient-contact push in the other
direction - so the fix is to have it ask instead of wait. This module GETs
the Apps Script web app's doGet endpoint (docs/appointment_sheet_poll.gs),
which hands back every sheet row that has been assigned a Sync ID, and feeds
them to appointment_sheet_sync.import_rows() - the same per-row
create/dedupe logic the old webhook used, just called from here instead of
from an inbound view.

Mirrors sheet_sync.py's established shape: plain urllib.request, a short
timeout, and "offline is not an error" - PollOffline is raised and meant to
be caught as a routine, expected condition rather than a failure.
"""

from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

from django.conf import settings

from .appointment_sheet_sync import import_rows

logger = logging.getLogger(__name__)

# Matches sheet_sync.py's TIMEOUT_SECONDS - a clinic machine on a slow
# connection should wait a little, but a scheduled poll must not hang forever.
TIMEOUT_SECONDS = 30


class PollError(Exception):
    """The poll could not complete. Carries a message meant for clinic staff."""


class PollOffline(PollError):
    """No usable connection. Expected, not a fault - try again later."""


@dataclass
class PollResult:
    created: int = 0
    duplicate: int = 0
    error: int = 0
    errors: list[dict] = field(default_factory=list)

    @property
    def total(self) -> int:
        return self.created + self.duplicate + self.error

    def summary(self) -> str:
        noun = "row" if self.total == 1 else "rows"
        return (
            f"{self.total} {noun}: {self.created} created, "
            f"{self.duplicate} already imported, {self.error} failed"
        )


def is_configured() -> bool:
    """True when the Apps Script URL and its shared token have both been set."""
    return bool(
        getattr(settings, "APPOINTMENT_SHEET_POLL_URL", "")
        and getattr(settings, "APPOINTMENT_SHEET_TOKEN", "")
    )


def _get(url: str) -> dict:
    """GET a URL on the Apps Script deployment and return its parsed JSON."""
    request = urllib.request.Request(
        url,
        headers={
            # Apps Script rejects requests without a recognisable agent.
            "User-Agent": "belin-clinic-sync/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        if exc.code in (401, 403):
            raise PollError(
                "The sheet's script rejected the token. Check "
                "APPOINTMENT_SHEET_TOKEN in backend/.env matches the TOKEN "
                "in the Apps Script, then redeploy the script."
            ) from exc
        if exc.code == 404:
            raise PollError(
                "The poll URL was not found. Re-copy the Web app URL from the "
                "Apps Script deployment and update APPOINTMENT_SHEET_POLL_URL."
            ) from exc
        raise PollError(
            f"The sheet's script returned HTTP {exc.code}. {detail}"
        ) from exc
    except (urllib.error.URLError, socket.timeout, TimeoutError, OSError) as exc:
        # The ordinary offline case on a clinic machine.
        raise PollOffline(
            "No internet connection - new bookings will be picked up the "
            "next time this runs while online."
        ) from exc

    try:
        reply = json.loads(raw)
    except json.JSONDecodeError as exc:
        # Almost always a sign-in page: the deployment's access is not set to
        # "Anyone", so Google served HTML instead of running the script.
        if "<html" in raw.lower() or "accounts.google.com" in raw.lower():
            raise PollError(
                "Google returned a sign-in page instead of running the script. "
                "In the Apps Script deployment set 'Who has access' to "
                "'Anyone', then redeploy and copy the new URL."
            ) from exc
        raise PollError(
            f"The sheet's script returned something unreadable: {raw[:200]}"
        ) from exc

    if not reply.get("ok"):
        raise PollError(
            f"The sheet's script reported: {reply.get('error', 'unknown error')}"
        )
    return reply


def _poll_url(**params: str) -> str:
    url = settings.APPOINTMENT_SHEET_POLL_URL
    query = urllib.parse.urlencode(
        {"token": settings.APPOINTMENT_SHEET_TOKEN, **params}
    )
    return f"{url}{'&' if '?' in url else '?'}{query}"


def _fetch_rows() -> list[dict]:
    """The sheet's current rows - every one that has been assigned a Sync ID,
    whatever its past Sync Status. Re-seeing an already-imported row is
    expected; import_rows() treats it as a harmless duplicate.
    """
    reply = _get(_poll_url())
    rows = reply.get("rows")
    if not isinstance(rows, list):
        raise PollError("The sheet's script returned no 'rows' list.")
    return rows


def _mark_imported(row_id: str) -> None:
    """Best-effort courtesy call so the sheet shows which rows have landed,
    purely for the clinic's own visibility when they look at it - see
    markImported() in docs/appointment_sheet_poll.gs. Never allowed to affect
    the result of a poll: the import this follows has already succeeded, and
    Django's dedup by row_id is authoritative regardless of whether this call
    ever lands.
    """
    try:
        _get(_poll_url(mark=row_id))
    except Exception:  # noqa: BLE001 - cosmetic only, never allowed to matter
        logger.debug("Could not mark row %s as imported on the sheet.", row_id)


def poll(*, dry_run: bool = False) -> PollResult:
    """Pull any new booking rows from the sheet and import them.

    Returns counts. Raises PollOffline when there is simply no connection,
    which callers running on a timer should treat as routine, and PollError
    for anything else that went wrong.
    """
    if not is_configured():
        raise PollError(
            "Appointment sheet poll is not configured. Set "
            "APPOINTMENT_SHEET_POLL_URL and APPOINTMENT_SHEET_TOKEN in "
            "backend/.env."
        )

    if dry_run:
        # Deliberately does not touch the network. Unlike the patient sheet
        # sync's --dry-run, there is nothing local to preview here - the data
        # lives in the sheet, not this database - so this simply confirms the
        # feature is configured without actually contacting Google.
        return PollResult()

    rows = _fetch_rows()
    results = import_rows(rows)

    result = PollResult()
    for item in results:
        outcome = item.get("result")
        if outcome == "created":
            result.created += 1
            _mark_imported(item["row_id"])
        elif outcome == "duplicate":
            result.duplicate += 1
        else:
            result.error += 1
            result.errors.append(item)

    logger.info("Appointment sheet poll: %s", result.summary())
    return result
