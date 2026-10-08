"""Tests for the appointment workflow: acceptance, rescheduling, walk-ins,
check-in, slot conflicts and patient notifications.

The theme running through these is the separation the workflow depends on:
the appointment is authoritative, the email is a side effect, and the
scheduled time is a different fact from when the patient actually arrived.
Several tests exist specifically to pin those apart.
"""

from datetime import date, datetime, time, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase

from ..identifiers import create_with_patient_code
from ..models import (
    Appointment,
    AppointmentHistory,
    AppointmentNotification,
    DentistAvailability,
    Patient,
    StaffProfile,
)


def make_staff(username, role):
    user = get_user_model().objects.create_user(username=username, password="pw12345!")
    StaffProfile.objects.create(user=user, full_name=username, role=role)
    return user


def next_weekday(weekday: int) -> date:
    today = date.today()
    ahead = (weekday - today.weekday()) % 7
    return today + timedelta(days=ahead or 7)


class WorkflowTestCase(APITestCase):
    """Shared fixture: a clinic open on one weekday, and a booked patient."""

    def setUp(self):
        self.workday = next_weekday(0)  # a Monday comfortably in the future
        DentistAvailability.objects.create(
            day_of_week=0, start_time=time(9, 0), end_time=time(13, 0), is_active=True
        )
        self.dentist = make_staff("dr_wf", StaffProfile.Role.DENTIST)
        self.receptionist = make_staff("recep_wf", StaffProfile.Role.RECEPTIONIST)
        self.patient = create_with_patient_code(
            Patient,
            first_name="John",
            last_name="Mathew",
            phone="+91 98765 43210",
            email="john@example.com",
        )

    def book_as_staff(self, at=time(10, 30), name="John Mathew", email="john@example.com"):
        """Create a fixture appointment the way staff now must.

        Used to be a public, unauthenticated booking that the matcher linked
        to self.patient by phone; the public website moved to a separate,
        differently-authenticated service and this backend no longer accepts
        an anonymous create (see PublicBookingSecurityTests), so staff make
        this booking instead and - since staff pick a patient explicitly
        rather than going through the matcher - `patient` is passed
        explicitly to keep that same link.
        """
        self.client.force_authenticate(self.receptionist)
        return self.client.post(
            "/api/appointments/",
            {
                "patient": str(self.patient.uuid),
                "patient_name": name,
                "phone": "+91 98765 43210",
                "email": email,
                "reason": "Tooth Pain",
                "appointment_date": self.workday.isoformat(),
                "appointment_time": at.isoformat(),
                "notes": "",
            },
            format="json",
        )


class AcceptanceTests(WorkflowTestCase):
    def test_anonymous_user_cannot_confirm(self):
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(user=None)
        response = self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(
            Appointment.objects.get(pk=appointment_id).status, "pending"
        )

    def test_staff_can_confirm_and_it_is_stamped(self):
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")
        self.assertEqual(response.status_code, 200)

        appointment = Appointment.objects.get(pk=appointment_id)
        self.assertEqual(appointment.status, "confirmed")
        self.assertIsNotNone(appointment.confirmed_at)
        self.assertEqual(appointment.confirmed_by, self.receptionist)

    def test_booking_sends_no_email(self):
        """Confirmation is the only email a patient gets.

        A booking is a request the clinic may still decline, so acknowledging
        it was dropped deliberately - the patient hears from the clinic once,
        when the appointment is actually confirmed.
        """
        response = self.book_as_staff()
        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(response.data["notification"]["attempted"])
        self.assertFalse(
            AppointmentNotification.objects.filter(
                notification_type="booking_received"
            ).exists()
        )

    def test_confirmation_emails_the_patient(self):
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")

        self.assertEqual(response.data["notification"]["status"], "sent")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Confirmed", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["john@example.com"])
        self.assertTrue(
            AppointmentNotification.objects.filter(
                appointment_id=appointment_id, notification_type="confirmation", status="sent"
            ).exists()
        )

    def test_confirmation_email_is_sent_as_text_and_html(self):
        appointment_id = self.book_as_staff().data["id"]
        mail.outbox.clear()
        self.client.force_authenticate(self.receptionist)
        self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")

        message = mail.outbox[0]
        self.assertTrue(message.body.strip())
        types = [content_type for _, content_type in message.alternatives]
        self.assertIn("text/html", types)

    def test_confirmation_states_the_final_time_after_a_reschedule(self):
        """§20: approving a request that was moved must confirm the NEW time."""
        appointment_id = self.book_as_staff(at=time(10, 30)).data["id"]
        self.client.force_authenticate(self.receptionist)
        self.client.post(
            f"/api/appointments/{appointment_id}/reschedule/",
            {
                "appointment_date": self.workday.isoformat(),
                "appointment_time": "11:30",
                "reason": "10:30 not available",
            },
            format="json",
        )
        mail.outbox.clear()
        self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")

        body = mail.outbox[0].body
        self.assertIn("11:30 AM", body)
        # And it says plainly that this differs from what was asked for.
        self.assertIn("originally requested", body)
        self.assertIn("10:30 AM", body)

    def test_the_originally_requested_time_is_preserved(self):
        appointment_id = self.book_as_staff(at=time(10, 30)).data["id"]
        self.client.force_authenticate(self.receptionist)
        self.client.post(
            f"/api/appointments/{appointment_id}/reschedule/",
            {
                "appointment_date": self.workday.isoformat(),
                "appointment_time": "11:30",
                "reason": "moved",
            },
            format="json",
        )
        appointment = Appointment.objects.get(pk=appointment_id)
        self.assertEqual(appointment.requested_time, time(10, 30))
        self.assertEqual(appointment.appointment_time, time(11, 30))
        self.assertTrue(appointment.was_moved_before_confirming)

    def test_confirmation_email_carries_no_clinical_information(self):
        """Appointment mail is administrative only - §4."""
        appointment = Appointment.objects.create(
            patient=self.patient, patient_name="John Mathew", phone="x",
            email="john@example.com", reason="Root canal assessment",
            appointment_date=self.workday, appointment_time=time(9, 0),
            notes="Suspected abscess on 36; patient on warfarin",
        )
        self.client.force_authenticate(self.dentist)
        self.client.post(f"/api/appointments/{appointment.pk}/confirm/", {}, format="json")

        body = mail.outbox[0].body
        for leaked in ["abscess", "warfarin", "36"]:
            self.assertNotIn(leaked, body)

    def test_confirmation_survives_an_email_failure(self):
        """The clinic's decision stands even when SMTP does not - §5."""
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)

        with mock.patch(
            "django.core.mail.EmailMessage.send", side_effect=OSError("SMTP unavailable")
        ):
            response = self.client.post(
                f"/api/appointments/{appointment_id}/confirm/", {}, format="json"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Appointment.objects.get(pk=appointment_id).status, "confirmed")
        self.assertEqual(response.data["notification"]["status"], "failed")
        self.assertIn("SMTP unavailable", response.data["notification"]["detail"])

    def test_confirming_twice_does_not_email_twice(self):
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)
        self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")
        second = self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")

        self.assertEqual(second.status_code, 400)
        self.assertEqual(
            AppointmentNotification.objects.filter(notification_type="confirmation").count(), 1
        )
        confirmations = [m for m in mail.outbox if "Confirmed" in m.subject]
        self.assertEqual(len(confirmations), 1)

    def test_a_blank_booking_email_falls_back_to_the_patient_record(self):
        """Someone who left the field empty is still reachable if we hold an
        address for them - not writing to it would be unhelpful, not careful."""
        appointment_id = self.book_as_staff(email="").data["id"]
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")

        self.assertEqual(response.data["notification"]["status"], "sent")
        self.assertEqual(mail.outbox[0].to, [self.patient.email])

    def test_no_address_anywhere_is_skipped_not_failed(self):
        """Nobody to write to is not a delivery failure; it is recorded as
        skipped so it shows in the log instead of looking like a broken SMTP."""
        appointment = Appointment.objects.create(
            patient_name="Unreachable Person", phone="+91 95555 55555", email="",
            reason="Checkup", appointment_date=self.workday, appointment_time=time(9, 0),
        )
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            f"/api/appointments/{appointment.pk}/confirm/", {}, format="json"
        )

        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "confirmed")
        self.assertEqual(response.data["notification"]["status"], "skipped")
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(
            AppointmentNotification.objects.get(appointment=appointment).status, "skipped"
        )


class RescheduleTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            patient_name="John Mathew",
            phone="+91 98765 43210",
            email="john@example.com",
            reason="Tooth Pain",
            appointment_date=self.workday,
            appointment_time=time(10, 30),
            status=Appointment.Status.CONFIRMED,
        )
        self.client.force_authenticate(self.receptionist)

    def reschedule(self, at=time(11, 30), on=None, **extra):
        payload = {
            "appointment_date": (on or self.workday).isoformat(),
            "appointment_time": at.isoformat(),
            "reason": "Patient requested another time",
        }
        payload.update(extra)
        return self.client.post(
            f"/api/appointments/{self.appointment.pk}/reschedule/", payload, format="json"
        )

    def test_appointment_can_be_rescheduled(self):
        response = self.reschedule()
        self.assertEqual(response.status_code, 200)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.appointment_time, time(11, 30))

    def test_a_reason_is_required(self):
        response = self.client.post(
            f"/api/appointments/{self.appointment.pk}/reschedule/",
            {"appointment_date": self.workday.isoformat(), "appointment_time": "11:30"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_the_old_schedule_is_preserved_in_history(self):
        """§8: rescheduling must not quietly replace the previous time."""
        self.reschedule()
        entry = AppointmentHistory.objects.filter(
            appointment=self.appointment, event_type="rescheduled"
        ).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.old_time, time(10, 30))
        self.assertEqual(entry.new_time, time(11, 30))
        self.assertEqual(entry.old_date, self.workday)
        self.assertEqual(entry.reason, "Patient requested another time")
        self.assertEqual(entry.changed_by, self.receptionist)

    def test_reschedule_notifies_the_patient_with_both_times(self):
        response = self.reschedule()
        self.assertEqual(response.data["notification"]["status"], "sent")
        body = mail.outbox[-1].body
        self.assertIn("10:30 AM", body)
        self.assertIn("11:30 AM", body)
        self.assertTrue(
            AppointmentNotification.objects.filter(notification_type="reschedule").exists()
        )

    def test_reschedule_rejects_an_occupied_slot(self):
        Appointment.objects.create(
            patient_name="Sarah Joseph", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        response = self.reschedule()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["conflict"]["patient_name"], "Sarah Joseph")
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.appointment_time, time(10, 30))

    def test_reschedule_rejects_a_time_outside_working_hours(self):
        response = self.reschedule(at=time(21, 0))
        self.assertEqual(response.status_code, 400)

    def test_unauthorized_user_cannot_override_a_conflict(self):
        Appointment.objects.create(
            patient_name="Sarah Joseph", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        response = self.reschedule(override=True, override_reason="Emergency")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.data["can_override"])
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.appointment_time, time(10, 30))

    def test_authorized_override_accepts_an_occupied_slot(self):
        Appointment.objects.create(
            patient_name="Sarah Joseph", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        self.client.force_authenticate(self.dentist)
        response = self.reschedule(override=True, override_reason="Emergency tooth pain")

        self.assertEqual(response.status_code, 200)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.appointment_time, time(11, 30))
        self.assertTrue(self.appointment.slot_override)
        self.assertEqual(self.appointment.slot_override_reason, "Emergency tooth pain")

    def test_override_requires_a_reason(self):
        Appointment.objects.create(
            patient_name="Sarah Joseph", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        self.client.force_authenticate(self.dentist)
        response = self.reschedule(override=True)
        self.assertEqual(response.status_code, 400)
        self.assertIn("override_reason", response.data)

    def test_override_is_recorded_in_history(self):
        blocker = Appointment.objects.create(
            patient_name="Sarah Joseph", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        self.client.force_authenticate(self.dentist)
        self.reschedule(override=True, override_reason="Emergency tooth pain")

        entry = AppointmentHistory.objects.filter(event_type="slot_override").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.reason, "Emergency tooth pain")
        self.assertEqual(entry.detail["conflicting_appointment_id"], blocker.pk)

    def test_explicit_django_permission_grants_override_without_a_role_change(self):
        """§11: a trusted receptionist can be granted override individually."""
        Appointment.objects.create(
            patient_name="Sarah Joseph", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        self.receptionist.user_permissions.add(
            Permission.objects.get(codename="override_appointment_slot")
        )
        self.receptionist = get_user_model().objects.get(pk=self.receptionist.pk)
        self.client.force_authenticate(self.receptionist)

        response = self.reschedule(override=True, override_reason="Doctor approved")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            StaffProfile.objects.get(user=self.receptionist).role, StaffProfile.Role.RECEPTIONIST
        )

    def test_a_completed_appointment_cannot_be_rescheduled(self):
        self.appointment.status = Appointment.Status.COMPLETED
        self.appointment.save()
        self.assertEqual(self.reschedule().status_code, 400)


class CheckInTests(WorkflowTestCase):
    """§20-§23: arrival is a different event from the scheduled time."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.receptionist)

    def make_today(self, at):
        return Appointment.objects.create(
            patient=self.patient, patient_name="John Mathew", phone="x",
            email="john@example.com", reason="Tooth Pain",
            appointment_date=date.today(), appointment_time=at,
            status=Appointment.Status.CONFIRMED,
        )

    def check_in(self, appointment, arrived_at=None):
        payload = {"arrived_at": arrived_at.isoformat()} if arrived_at else {}
        return self.client.post(
            f"/api/appointments/{appointment.pk}/check-in/", payload, format="json"
        )

    def test_check_in_records_the_timestamp_and_status(self):
        appointment = self.make_today(time(10, 30))
        response = self.check_in(appointment)
        self.assertEqual(response.status_code, 200)

        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "checked_in")
        self.assertIsNotNone(appointment.checked_in_at)
        self.assertEqual(appointment.checked_in_by, self.receptionist)

    def test_late_arrival_does_not_change_the_scheduled_time(self):
        """Booked 10:30, arrives 11:15. The 10:30 must survive."""
        appointment = self.make_today(time(10, 30))
        arrival = timezone.localtime().replace(hour=11, minute=15, second=0, microsecond=0)
        if arrival > timezone.localtime():
            arrival = timezone.localtime()
        self.check_in(appointment, arrival)

        appointment.refresh_from_db()
        self.assertEqual(appointment.appointment_time, time(10, 30))
        self.assertEqual(timezone.localtime(appointment.checked_in_at).hour, arrival.hour)

    def test_early_arrival_does_not_change_the_scheduled_time(self):
        """Booked 11:00, arrives 10:30. The appointment is still an 11:00."""
        appointment = self.make_today(time(23, 0))
        arrival = timezone.now()
        self.check_in(appointment, arrival)

        appointment.refresh_from_db()
        self.assertEqual(appointment.appointment_time, time(23, 0))
        self.assertIsNotNone(appointment.checked_in_at)
        self.assertLess(appointment.arrival_delay_minutes, 0)

    def test_arrival_time_can_be_corrected_and_the_correction_is_recorded(self):
        appointment = self.make_today(time(10, 30))
        self.check_in(appointment)
        corrected = timezone.now() - timedelta(minutes=20)
        self.check_in(appointment, corrected)

        appointment.refresh_from_db()
        self.assertEqual(
            appointment.checked_in_at.replace(microsecond=0), corrected.replace(microsecond=0)
        )
        self.assertTrue(
            AppointmentHistory.objects.filter(
                appointment=appointment, event_type="arrival_corrected"
            ).exists()
        )
        # Correcting the arrival still must not touch the schedule.
        self.assertEqual(appointment.appointment_time, time(10, 30))

    def test_a_future_arrival_time_is_rejected(self):
        appointment = self.make_today(time(10, 30))
        response = self.check_in(appointment, timezone.now() + timedelta(hours=3))
        self.assertEqual(response.status_code, 400)

    def test_a_cancelled_appointment_cannot_be_checked_in(self):
        appointment = self.make_today(time(10, 30))
        appointment.status = Appointment.Status.CANCELLED
        appointment.save()
        self.assertEqual(self.check_in(appointment).status_code, 400)


class WalkInTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.receptionist)

    def register(self, **payload):
        body = {"reason": "Severe tooth pain"}
        body.update(payload)
        return self.client.post("/api/appointments/walk-in/", body, format="json")

    def test_walk_in_uses_an_existing_patient(self):
        response = self.register(patient=str(self.patient.uuid))
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["patient_created"])
        self.assertEqual(
            response.data["appointment"]["patient"]["patient_code"], self.patient.patient_code
        )
        self.assertEqual(Patient.objects.count(), 1)

    def test_walk_in_can_create_a_new_patient(self):
        response = self.register(
            first_name="Arun", last_name="Kumar", phone="+91 91111 22222"
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["patient_created"])
        self.assertEqual(Patient.objects.count(), 2)
        self.assertTrue(
            Patient.objects.filter(first_name="Arun", last_name="Kumar").exists()
        )

    def test_walk_in_needs_either_a_patient_or_a_name(self):
        self.assertEqual(self.register().status_code, 400)

    def test_walk_in_defaults(self):
        """§19: today, now, walk_in, checked in."""
        response = self.register(patient=str(self.patient.uuid))
        appointment = Appointment.objects.get(pk=response.data["appointment"]["id"])

        self.assertEqual(appointment.source, "walk_in")
        self.assertEqual(appointment.status, "checked_in")
        self.assertEqual(appointment.appointment_date, date.today())
        self.assertIsNotNone(appointment.checked_in_at)

    def test_walk_in_arrival_time_can_be_corrected(self):
        arrival = timezone.now() - timedelta(minutes=25)
        response = self.register(patient=str(self.patient.uuid), arrived_at=arrival.isoformat())
        appointment = Appointment.objects.get(pk=response.data["appointment"]["id"])
        self.assertEqual(
            appointment.checked_in_at.replace(microsecond=0), arrival.replace(microsecond=0)
        )

    def test_a_walk_in_does_not_block_a_booked_slot(self):
        """A walk-in is an unscheduled arrival, not a reservation.

        Two people may also walk in during the same minute, which the old
        one-appointment-per-slot constraint would have refused.
        """
        first = self.register(patient=str(self.patient.uuid))
        second = self.register(first_name="Second", last_name="Walkin")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)

    def test_walk_in_appears_in_todays_queue(self):
        self.register(patient=str(self.patient.uuid))
        queue = self.client.get("/api/dentist/today/")
        sources = [a["source"] for a in queue.data["appointments"]]
        self.assertIn("walk_in", sources)

    def test_walk_in_search_finds_existing_patients(self):
        response = self.client.get(
            "/api/appointments/walk-in/search/", {"search": "98765 43210"}
        )
        self.assertEqual(response.status_code, 200)
        codes = [p["patient_code"] for p in response.data["results"]]
        self.assertIn(self.patient.patient_code, codes)

    def test_walk_in_search_warns_about_a_likely_duplicate(self):
        """§54: reception sees the number is already on file before creating."""
        response = self.client.get(
            "/api/appointments/walk-in/search/", {"phone": "+91 98765 43210"}
        )
        codes = [p["patient_code"] for p in response.data["likely_existing"]]
        self.assertIn(self.patient.patient_code, codes)


class CancellationTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.receptionist)
        self.appointment = Appointment.objects.create(
            patient=self.patient, patient_name="John Mathew", phone="x",
            email="john@example.com", reason="Tooth Pain",
            appointment_date=self.workday, appointment_time=time(10, 30),
            status=Appointment.Status.CONFIRMED,
        )

    def test_cancelling_keeps_the_appointment(self):
        """§28: cancelled, never deleted."""
        response = self.client.post(
            f"/api/appointments/{self.appointment.pk}/cancel/",
            {"reason": "Patient requested cancellation"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.status, "cancelled")
        self.assertEqual(self.appointment.cancellation_reason, "Patient requested cancellation")
        self.assertIsNotNone(self.appointment.cancelled_at)
        self.assertTrue(Appointment.objects.filter(pk=self.appointment.pk).exists())

    def test_cancellation_notifies_the_patient(self):
        response = self.client.post(
            f"/api/appointments/{self.appointment.pk}/cancel/", {"reason": "Clinic closed"},
            format="json",
        )
        self.assertEqual(response.data["notification"]["status"], "sent")
        self.assertIn("Cancelled", mail.outbox[-1].subject)
        self.assertTrue(
            AppointmentNotification.objects.filter(notification_type="cancellation").exists()
        )

    def test_declining_a_pending_request_uses_softer_wording(self):
        """A request that was never accepted is not an appointment being
        cancelled on someone - §18. The patient did nothing wrong and the
        email must not read as a rebuke."""
        self.appointment.status = Appointment.Status.PENDING
        self.appointment.save()
        mail.outbox.clear()
        self.client.post(
            f"/api/appointments/{self.appointment.pk}/cancel/",
            {"reason": "Requested slot unavailable"},
            format="json",
        )

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertIn("Update About Your Appointment Request", message.subject)
        for harsh in ["rejected", "cancelled", "Cancelled"]:
            self.assertNotIn(harsh, message.body)
        self.assertIn("unable to confirm", message.body)
        self.assertTrue(
            AppointmentNotification.objects.filter(
                notification_type="request_declined"
            ).exists()
        )

    def test_cancellation_is_recorded_in_history(self):
        self.client.post(
            f"/api/appointments/{self.appointment.pk}/cancel/", {"reason": "Patient asked"},
            format="json",
        )
        entry = AppointmentHistory.objects.filter(event_type="cancelled").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.old_status, "confirmed")
        self.assertEqual(entry.new_status, "cancelled")

    def test_a_cancelled_slot_becomes_bookable_again(self):
        self.client.post(
            f"/api/appointments/{self.appointment.pk}/cancel/", {"reason": "x"}, format="json"
        )
        self.client.force_authenticate(self.receptionist)
        rebooked = self.client.post(
            "/api/appointments/",
            {
                "patient_name": "Someone Else", "phone": "+91 90000 00000", "email": "",
                "reason": "Checkup", "appointment_date": self.workday.isoformat(),
                "appointment_time": "10:30", "notes": "",
            },
            format="json",
        )
        self.assertEqual(rebooked.status_code, 201)


class EditTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.receptionist)
        self.appointment = Appointment.objects.create(
            patient=self.patient, patient_name="John Mathew", phone="x",
            email="john@example.com", reason="Tooth Pain",
            appointment_date=self.workday, appointment_time=time(10, 30),
            status=Appointment.Status.CONFIRMED,
        )

    def test_editing_administrative_fields_records_an_edit(self):
        response = self.client.post(
            f"/api/appointments/{self.appointment.pk}/edit/",
            {"reason": "Tooth pain, upper left", "notes": "Bring previous x-rays"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.reason, "Tooth pain, upper left")
        self.assertTrue(
            AppointmentHistory.objects.filter(
                appointment=self.appointment, event_type="edited"
            ).exists()
        )
        self.assertEqual(len(mail.outbox), 0)

    def test_editing_the_time_is_treated_as_a_reschedule(self):
        """However staff reach it, moving an appointment tells the patient."""
        response = self.client.post(
            f"/api/appointments/{self.appointment.pk}/edit/",
            {"appointment_time": "11:30", "change_reason": "Clinic running behind"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            AppointmentHistory.objects.filter(
                appointment=self.appointment, event_type="rescheduled"
            ).exists()
        )
        self.assertEqual(response.data["notification"]["status"], "sent")

    def test_editing_into_an_occupied_slot_conflicts(self):
        Appointment.objects.create(
            patient_name="Sarah", phone="x", reason="Cleaning",
            appointment_date=self.workday, appointment_time=time(11, 30),
            status=Appointment.Status.CONFIRMED,
        )
        response = self.client.post(
            f"/api/appointments/{self.appointment.pk}/edit/",
            {"appointment_time": "11:30"}, format="json",
        )
        self.assertEqual(response.status_code, 409)


class HistoryEndpointTests(WorkflowTestCase):
    def test_history_endpoint_returns_events_and_notifications(self):
        self.client.force_authenticate(self.receptionist)
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)
        self.client.post(f"/api/appointments/{appointment_id}/confirm/", {}, format="json")

        response = self.client.get(f"/api/appointments/{appointment_id}/history/")
        self.assertEqual(response.status_code, 200)
        events = [h["event_type"] for h in response.data["history"]]
        self.assertIn("confirmed", events)
        self.assertIn("created", events)
        types = {n["notification_type"] for n in response.data["notifications"]}
        self.assertIn("confirmation", types)
        self.assertNotIn("booking_received", types)

    def test_history_requires_staff(self):
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(user=None)
        response = self.client.get(f"/api/appointments/{appointment_id}/history/")
        self.assertIn(response.status_code, (401, 403))


class EmailRenderingTests(WorkflowTestCase):
    """The message the patient actually receives."""

    def test_plain_text_email_is_not_html_escaped(self):
        """A clinic named "Belin's" must not arrive as "Belin&#x27;s".

        Django autoescapes by default, which is correct for the HTML part and
        wrong for the text part; the text engine is configured separately.
        """
        from ..models import ClinicSettings
        from ..notifications import build_message

        settings_obj = ClinicSettings.load()
        settings_obj.clinic_name = "Belin's Dental Clinic"
        settings_obj.save()

        appointment = Appointment.objects.create(
            patient_name="John Mathew", phone="x", email="john@example.com",
            reason="Checkup", appointment_date=self.workday, appointment_time=time(9, 0),
        )
        subject, body = build_message(appointment, "confirmation")
        self.assertIn("Belin's Dental Clinic", body)
        self.assertNotIn("&#x27;", body)
        self.assertNotIn("&amp;", body)
        self.assertIn("Belin's Dental Clinic", subject)

    def test_every_notification_type_renders(self):
        """Guards against a template that only breaks for one message type."""
        from ..models import AppointmentNotification
        from ..notifications import build_message

        appointment = Appointment.objects.create(
            patient_name="John Mathew", phone="x", email="john@example.com",
            reason="Checkup", appointment_date=self.workday, appointment_time=time(9, 0),
        )
        extra = {"previous_date": "20 September 2026", "previous_time": "10:30 AM"}
        for kind, _ in AppointmentNotification.Type.choices:
            if kind == "reminder":
                continue  # no template yet; not sent by any code path
            subject, body = build_message(appointment, kind, extra)
            self.assertTrue(subject.strip(), kind)
            self.assertIn("John", body, kind)


class ResendTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.receptionist)
        self.appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)

    def test_resend_retries_a_failed_confirmation_without_changing_status(self):
        with mock.patch(
            "django.core.mail.EmailMessage.send", side_effect=OSError("SMTP down")
        ):
            self.client.post(
                f"/api/appointments/{self.appointment_id}/confirm/", {}, format="json"
            )
        appointment = Appointment.objects.get(pk=self.appointment_id)
        self.assertEqual(appointment.status, "confirmed")

        mail.outbox.clear()
        response = self.client.post(
            f"/api/appointments/{self.appointment_id}/resend-notification/", {}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["notification"]["status"], "sent")
        # The retry must not have touched the appointment itself.
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "confirmed")

    def test_resend_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f"/api/appointments/{self.appointment_id}/resend-notification/", {}, format="json"
        )
        self.assertIn(response.status_code, (401, 403))


class PublicBookingSecurityTests(WorkflowTestCase):
    def test_public_cannot_create_an_appointment(self):
        """The public website's booking moved to a separate, differently-
        authenticated service; an anonymous create against this backend must
        be refused outright, not merely have its status overridden."""
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/appointments/",
            {
                "patient_name": "Sneaky", "phone": "+91 91111 00000", "email": "",
                "reason": "x", "appointment_date": self.workday.isoformat(),
                "appointment_time": "09:00", "status": "confirmed",
            },
            format="json",
        )
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(Appointment.objects.filter(phone="+91 91111 00000").exists())

    def test_public_cannot_read_other_appointments(self):
        self.book_as_staff()
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/appointments/").status_code, (401, 403))

    def test_public_cannot_reach_the_notification_history(self):
        appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(user=None)
        self.assertIn(
            self.client.get(f"/api/appointments/{appointment_id}/history/").status_code,
            (401, 403),
        )


class DeliveryReportingTests(WorkflowTestCase):
    """Reporting a message as delivered when it was not is how a clinic ends up
    believing a patient was told something they never received."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.receptionist)
        self.appointment_id = self.book_as_staff().data["id"]
        self.client.force_authenticate(self.receptionist)

    def test_a_non_delivering_backend_is_reported_as_not_delivered(self):
        with self.settings(
            EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend"
        ):
            response = self.client.post(
                f"/api/appointments/{self.appointment_id}/confirm/", {}, format="json"
            )
        outcome = response.data["notification"]
        # Django's own view of it is a successful send...
        self.assertEqual(outcome["status"], "sent")
        # ...but the clinic is told the truth.
        self.assertFalse(outcome["delivered"])
        self.assertFalse(outcome["delivery_configured"])

    def test_a_real_backend_is_reported_as_delivered(self):
        with self.settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            # locmem is itself non-delivering, so patch the check to stand in
            # for a configured SMTP backend while still capturing the message.
            with mock.patch("clinic.notifications.delivery_is_real", return_value=True):
                response = self.client.post(
                    f"/api/appointments/{self.appointment_id}/confirm/", {}, format="json"
                )
        outcome = response.data["notification"]
        self.assertEqual(outcome["status"], "sent")
        self.assertTrue(outcome["delivered"])

    def test_known_non_delivering_backends(self):
        from ..notifications import delivery_is_real

        for backend in [
            "django.core.mail.backends.console.EmailBackend",
            "django.core.mail.backends.locmem.EmailBackend",
            "django.core.mail.backends.dummy.EmailBackend",
        ]:
            with self.settings(EMAIL_BACKEND=backend):
                self.assertFalse(delivery_is_real(), backend)
        with self.settings(EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend"):
            self.assertTrue(delivery_is_real())
