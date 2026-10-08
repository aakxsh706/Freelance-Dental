"""Appointment sheet sync - pull-based (the reverse of test_sheet_sync.py).

The public website writes bookings into a Google Sheet instead of calling
this backend directly; this backend now PULLS new rows from it on a timer
rather than waiting for a push it could never receive on an offline, NAT'd
clinic PC (see the module docstring in clinic/appointment_sheet_poll.py for
why). Two things are covered here:

  * appointment_sheet_sync.import_rows() - the per-row create/dedupe logic,
    called directly rather than through an HTTP view, since the inbound
    webhook it used to live behind has been removed entirely.
  * appointment_sheet_poll.poll() and the poll_appointment_sheet command -
    against a mocked HTTP GET standing in for the Apps Script deployment, so
    the test suite never makes a real network call.
"""

import io
import json
import urllib.error
from datetime import date, timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from ..appointment_sheet_poll import PollOffline, poll
from ..appointment_sheet_sync import import_rows
from ..models import Appointment, DentistAvailability

POLL_SETTINGS = dict(
    APPOINTMENT_SHEET_POLL_URL="https://script.google.com/macros/s/fake/exec",
    APPOINTMENT_SHEET_TOKEN="test-poll-token",
)


def next_weekday(target_weekday: int) -> date:
    today = date.today()
    days_ahead = (target_weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


class FakeHttpResponse:
    """Stands in for the object urllib.request.urlopen() returns, just
    enough of it (read() plus context-manager support) for
    appointment_sheet_poll._get() to work with it."""

    def __init__(self, body: bytes):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False


def fake_rows_response(rows):
    return FakeHttpResponse(json.dumps({"ok": True, "rows": rows}).encode("utf-8"))


class ImportRowsTests(TestCase):
    """appointment_sheet_sync.import_rows() - the logic every row (however it
    arrives) is validated and turned into an Appointment through."""

    def setUp(self):
        self.monday = next_weekday(DentistAvailability.Weekday.MONDAY)
        DentistAvailability.objects.create(
            day_of_week=DentistAvailability.Weekday.MONDAY,
            start_time="09:00",
            end_time="12:00",
            is_active=True,
        )

    def _row(self, row_id="row-1", time="09:00", **overrides):
        row = {
            "row_id": row_id,
            "patient_name": "Sheet Patient",
            "phone": "9999999999",
            "email": "sheet@example.com",
            "reason": "Checkup",
            "notes": "",
            "appointment_date": self.monday.isoformat(),
            "appointment_time": time,
        }
        row.update(overrides)
        return row

    def test_valid_row_creates_an_appointment(self):
        results = import_rows([self._row()])

        self.assertEqual(len(results), 1)
        result = results[0]
        self.assertEqual(result["result"], "created")
        self.assertEqual(result["row_id"], "row-1")

        appointment = Appointment.objects.get(id=result["appointment_id"])
        self.assertEqual(appointment.external_reference, "row-1")
        self.assertEqual(appointment.patient_name, "Sheet Patient")
        self.assertEqual(appointment.phone, "9999999999")
        self.assertEqual(appointment.email, "sheet@example.com")
        self.assertEqual(appointment.reason, "Checkup")
        self.assertEqual(appointment.appointment_date, self.monday)
        self.assertEqual(str(appointment.appointment_time), "09:00:00")
        self.assertEqual(appointment.source, Appointment.Source.WEBSITE)
        self.assertEqual(appointment.status, Appointment.Status.PENDING)

    def test_replayed_row_id_is_reported_as_duplicate(self):
        first = import_rows([self._row(row_id="row-dup")])
        self.assertEqual(first[0]["result"], "created")

        # Same row handed back on a later poll - the sheet's doGet script
        # returns every row with a Sync ID on every call, past status or
        # not, precisely so this is expected rather than an error.
        second = import_rows([self._row(row_id="row-dup", time="10:00")])

        self.assertEqual(second[0]["result"], "duplicate")
        self.assertEqual(
            Appointment.objects.filter(external_reference="row-dup").count(), 1
        )

    def test_batch_with_one_valid_and_one_invalid_row_reports_independently(self):
        valid_row = self._row(row_id="row-valid", time="09:00")
        invalid_row = self._row(row_id="row-invalid", time="")  # blank time fails validation

        results = import_rows([valid_row, invalid_row])
        by_row_id = {row["row_id"]: row for row in results}

        self.assertEqual(by_row_id["row-valid"]["result"], "created")
        self.assertEqual(by_row_id["row-invalid"]["result"], "error")
        self.assertIn("appointment_time", by_row_id["row-invalid"]["detail"])

        self.assertEqual(
            Appointment.objects.filter(external_reference="row-valid").count(), 1
        )
        self.assertFalse(
            Appointment.objects.filter(external_reference="row-invalid").exists()
        )

    def test_missing_row_id_is_reported_as_error(self):
        results = import_rows([self._row(row_id="")])
        self.assertEqual(results[0]["result"], "error")
        self.assertEqual(Appointment.objects.count(), 0)


@override_settings(**POLL_SETTINGS)
class AppointmentSheetPollTests(TestCase):
    """poll() against a mocked GET standing in for the Apps Script
    deployment - never a real network call."""

    def setUp(self):
        self.monday = next_weekday(DentistAvailability.Weekday.MONDAY)
        DentistAvailability.objects.create(
            day_of_week=DentistAvailability.Weekday.MONDAY,
            start_time="09:00",
            end_time="12:00",
            is_active=True,
        )

    def _row(self, row_id="row-1", **overrides):
        row = {
            "row_id": row_id,
            "patient_name": "Sheet Patient",
            "phone": "9999999999",
            "email": "sheet@example.com",
            "reason": "Checkup",
            "notes": "",
            "appointment_date": self.monday.isoformat(),
            "appointment_time": "09:00",
        }
        row.update(overrides)
        return row

    @patch("clinic.appointment_sheet_poll.urllib.request.urlopen")
    def test_poll_imports_rows_from_the_mocked_response(self, mock_urlopen):
        # Every call (the initial fetch, and the best-effort "mark imported"
        # follow-up for the created row) hits this same fake response - the
        # follow-up call never parses it, so a generic rows payload is fine.
        mock_urlopen.return_value = fake_rows_response([self._row(row_id="row-polled")])

        result = poll()

        self.assertEqual(result.created, 1)
        self.assertEqual(result.duplicate, 0)
        self.assertEqual(result.error, 0)
        self.assertTrue(
            Appointment.objects.filter(external_reference="row-polled").exists()
        )
        # The fetch plus one "mark imported" follow-up for the created row.
        self.assertEqual(mock_urlopen.call_count, 2)

    @patch("clinic.appointment_sheet_poll.urllib.request.urlopen")
    def test_poll_reports_duplicates_without_creating_a_second_appointment(
        self, mock_urlopen
    ):
        import_rows([self._row(row_id="row-already-in")])
        mock_urlopen.return_value = fake_rows_response(
            [self._row(row_id="row-already-in")]
        )

        result = poll()

        self.assertEqual(result.created, 0)
        self.assertEqual(result.duplicate, 1)
        self.assertEqual(
            Appointment.objects.filter(external_reference="row-already-in").count(), 1
        )

    @patch("clinic.appointment_sheet_poll.urllib.request.urlopen")
    def test_poll_is_offline_when_the_connection_fails(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("no route to host")

        with self.assertRaises(PollOffline):
            poll()

        self.assertEqual(Appointment.objects.count(), 0)

    def test_poll_without_configuration_raises(self):
        from ..appointment_sheet_poll import PollError

        with override_settings(APPOINTMENT_SHEET_POLL_URL="", APPOINTMENT_SHEET_TOKEN=""):
            with self.assertRaises(PollError):
                poll()

    def test_dry_run_never_touches_the_network(self):
        with patch("clinic.appointment_sheet_poll.urllib.request.urlopen") as mock_urlopen:
            result = poll(dry_run=True)

        mock_urlopen.assert_not_called()
        self.assertEqual(result.total, 0)


class PollAppointmentSheetCommandTests(TestCase):
    """The management command staff/the installer can run by hand, and that
    start-clinic.bat/.sh and run_server.py both rely on behind the scenes."""

    def setUp(self):
        self.monday = next_weekday(DentistAvailability.Weekday.MONDAY)
        DentistAvailability.objects.create(
            day_of_week=DentistAvailability.Weekday.MONDAY,
            start_time="09:00",
            end_time="12:00",
            is_active=True,
        )

    def _row(self, row_id="row-1"):
        return {
            "row_id": row_id,
            "patient_name": "Sheet Patient",
            "phone": "9999999999",
            "email": "sheet@example.com",
            "reason": "Checkup",
            "notes": "",
            "appointment_date": self.monday.isoformat(),
            "appointment_time": "09:00",
        }

    def test_command_reports_unconfigured_without_crashing(self):
        out = io.StringIO()
        with override_settings(APPOINTMENT_SHEET_POLL_URL="", APPOINTMENT_SHEET_TOKEN=""):
            call_command("poll_appointment_sheet", stdout=out)

        self.assertIn("not configured", out.getvalue())

    @override_settings(**POLL_SETTINGS)
    def test_command_dry_run_never_touches_the_network(self):
        out = io.StringIO()
        with patch("clinic.appointment_sheet_poll.urllib.request.urlopen") as mock_urlopen:
            call_command("poll_appointment_sheet", "--dry-run", stdout=out)

        mock_urlopen.assert_not_called()
        self.assertIn("Dry run", out.getvalue())

    @override_settings(**POLL_SETTINGS)
    @patch("clinic.appointment_sheet_poll.urllib.request.urlopen")
    def test_command_imports_a_row_from_the_mocked_response(self, mock_urlopen):
        mock_urlopen.return_value = fake_rows_response([self._row(row_id="row-cmd")])
        out = io.StringIO()

        call_command("poll_appointment_sheet", stdout=out)

        self.assertIn("1 created", out.getvalue())
        self.assertTrue(
            Appointment.objects.filter(external_reference="row-cmd").exists()
        )

    @override_settings(**POLL_SETTINGS)
    @patch("clinic.appointment_sheet_poll.urllib.request.urlopen")
    def test_command_reports_being_offline_without_crashing(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError("no route to host")
        out = io.StringIO()

        call_command("poll_appointment_sheet", stdout=out)

        self.assertIn("No internet connection", out.getvalue())
        self.assertEqual(Appointment.objects.count(), 0)
