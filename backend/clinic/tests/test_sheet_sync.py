"""Patient sheet sync - the clinic's side of the webhook.

Reconciling rows is the Apps Script's job (docs/patient_sheet_webhook.gs), so
what matters here is what the clinic sends, what it refuses to send, and how
it behaves with no connection. The network is faked throughout: these tests
must pass on a machine with no internet, which is the machine this feature
exists for.
"""

import json
import socket
import urllib.error
from unittest.mock import patch

from django.test import TestCase, override_settings

from ..models import Patient
from ..sheet_sync import (
    COLUMNS,
    SheetOffline,
    SheetSyncError,
    desired_rows,
    is_configured,
    sync,
)

SHEET_SETTINGS = dict(
    PATIENT_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/test/exec",
    PATIENT_SHEET_WEBHOOK_TOKEN="test-token",
)


class FakeResponse:
    """Stands in for the object urlopen yields."""

    def __init__(self, body: str):
        self._body = body.encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def reply(**kwargs):
    payload = {"ok": True, "added": 0, "updated": 0, "unchanged": 0}
    payload.update(kwargs)
    return FakeResponse(json.dumps(payload))


@override_settings(**SHEET_SETTINGS)
class SentDataTests(TestCase):
    def setUp(self):
        self.alice = Patient.objects.create(
            patient_code="BEL-000001",
            first_name="Alice",
            last_name="Kumar",
            phone="+91 90000 00001",
            email="alice@example.com",
            city="Coimbatore",
        )

    def test_only_contact_details_are_sent(self):
        """Clinical and identifying extras must never reach the sheet."""
        self.alice.date_of_birth = "1990-05-04"
        self.alice.blood_group = "O+"
        self.alice.address_line_1 = "12 Residency Road"
        self.alice.emergency_contact_phone = "+91 90000 99999"
        self.alice.notes = "Anxious about extractions"
        self.alice.save()

        joined = " ".join(desired_rows()[0])
        self.assertIn("BEL-000001", joined)
        self.assertIn("alice@example.com", joined)
        for leaked in ("1990-05-04", "O+", "Residency", "99999", "Anxious"):
            self.assertNotIn(leaked, joined)

    def test_payload_carries_token_columns_and_rows(self):
        with patch("clinic.sheet_sync.urllib.request.urlopen", return_value=reply(added=1)) as opened:
            sync()

        request = opened.call_args[0][0]
        sent = json.loads(request.data.decode("utf-8"))
        self.assertEqual(sent["token"], "test-token")
        self.assertEqual(sent["columns"], COLUMNS)
        self.assertEqual(sent["rows"][0][0], "BEL-000001")
        self.assertEqual(request.get_method(), "POST")

    def test_full_desired_state_is_sent_every_run(self):
        """The script reconciles, so the clinic always sends everything."""
        Patient.objects.create(patient_code="BEL-000002", first_name="Bala")
        with patch("clinic.sheet_sync.urllib.request.urlopen", return_value=reply(unchanged=2)) as opened:
            sync()

        sent = json.loads(opened.call_args[0][0].data.decode("utf-8"))
        self.assertEqual(len(sent["rows"]), 2)

    def test_inactive_and_merged_patients_are_left_out(self):
        Patient.objects.create(
            patient_code="BEL-000009", first_name="Gone", is_active=False
        )
        merged = Patient.objects.create(patient_code="BEL-000010", first_name="Dupe")
        merged.merged_into = self.alice
        merged.save()

        self.assertEqual([row[0] for row in desired_rows()], ["BEL-000001"])

    def test_counts_come_back_from_the_script(self):
        with patch(
            "clinic.sheet_sync.urllib.request.urlopen",
            return_value=reply(added=2, updated=1, unchanged=5),
        ):
            result = sync()

        self.assertEqual((result.added, result.updated, result.unchanged), (2, 1, 5))
        self.assertTrue(result.wrote_anything)

    def test_nothing_to_do_is_reported_as_nothing_written(self):
        with patch("clinic.sheet_sync.urllib.request.urlopen", return_value=reply(unchanged=1)):
            result = sync()
        self.assertFalse(result.wrote_anything)


@override_settings(**SHEET_SETTINGS)
class FailureTests(TestCase):
    def setUp(self):
        Patient.objects.create(patient_code="BEL-000001", first_name="Alice")

    def test_no_connection_is_offline_not_a_crash(self):
        with patch(
            "clinic.sheet_sync.urllib.request.urlopen",
            side_effect=urllib.error.URLError("Name or service not known"),
        ):
            with self.assertRaises(SheetOffline):
                sync()

    def test_timeout_is_treated_as_offline(self):
        with patch("clinic.sheet_sync.urllib.request.urlopen", side_effect=socket.timeout()):
            with self.assertRaises(SheetOffline):
                sync()

    def test_sign_in_page_explains_the_deployment_setting(self):
        """The commonest setup mistake deserves the commonest fix."""
        html = FakeResponse("<html><body>Sign in - accounts.google.com</body></html>")
        with patch("clinic.sheet_sync.urllib.request.urlopen", return_value=html):
            with self.assertRaises(SheetSyncError) as caught:
                sync()
        self.assertIn("Anyone", str(caught.exception))

    def test_rejected_token_names_the_setting_to_fix(self):
        error = urllib.error.HTTPError(
            "https://script.google.com", 403, "Forbidden", {}, None
        )
        error.read = lambda: b"forbidden"
        with patch("clinic.sheet_sync.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(SheetSyncError) as caught:
                sync()
        self.assertIn("PATIENT_SHEET_WEBHOOK_TOKEN", str(caught.exception))

    def test_script_reported_error_is_surfaced(self):
        with patch(
            "clinic.sheet_sync.urllib.request.urlopen",
            return_value=FakeResponse(json.dumps({"ok": False, "error": "Bad token."})),
        ):
            with self.assertRaises(SheetSyncError) as caught:
                sync()
        self.assertIn("Bad token", str(caught.exception))

    def test_dry_run_does_not_touch_the_network(self):
        """--dry-run has to work on a machine with no connection."""
        with patch("clinic.sheet_sync.urllib.request.urlopen") as opened:
            result = sync(dry_run=True)
        opened.assert_not_called()
        self.assertEqual(result.total, 1)


class ConfigTests(TestCase):
    @override_settings(PATIENT_SHEET_WEBHOOK_URL="", PATIENT_SHEET_WEBHOOK_TOKEN="")
    def test_unconfigured_is_detected(self):
        self.assertFalse(is_configured())

    @override_settings(
        PATIENT_SHEET_WEBHOOK_URL="https://example.com", PATIENT_SHEET_WEBHOOK_TOKEN=""
    )
    def test_url_without_token_counts_as_unconfigured(self):
        """An unguarded webhook is worse than a disabled one."""
        self.assertFalse(is_configured())

    @override_settings(PATIENT_SHEET_WEBHOOK_URL="", PATIENT_SHEET_WEBHOOK_TOKEN="")
    def test_sync_refuses_clearly_when_unconfigured(self):
        with self.assertRaises(SheetSyncError) as caught:
            sync()
        self.assertIn("not configured", str(caught.exception))
