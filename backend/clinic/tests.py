from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Appointment, DentistAvailability


def next_weekday(target_weekday: int) -> date:
    today = date.today()
    days_ahead = (target_weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


class AvailabilityAndBookingTests(APITestCase):
    def setUp(self):
        # A predictable Monday with a single working window, far enough out
        # that "is this slot in the past" never becomes a factor.
        self.monday = next_weekday(DentistAvailability.Weekday.MONDAY)
        DentistAvailability.objects.create(
            day_of_week=DentistAvailability.Weekday.MONDAY,
            start_time="09:00",
            end_time="10:00",
            is_active=True,
        )

    def _book(self, time="09:00", **overrides):
        payload = {
            "patient_name": "Test Patient",
            "phone": "9999999999",
            "email": "patient@example.com",
            "reason": "Checkup",
            "appointment_date": self.monday.isoformat(),
            "appointment_time": time,
            "notes": "",
        }
        payload.update(overrides)
        return self.client.post(reverse("appointment-list"), payload, format="json")

    def test_availability_lists_configured_slots(self):
        response = self.client.get(
            reverse("availability"), {"date": self.monday.isoformat()}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        times = [slot["time"] for slot in response.data["slots"]]
        self.assertEqual(times, ["09:00", "09:30"])
        self.assertTrue(all(slot["status"] == "available" for slot in response.data["slots"]))

    def test_booking_marks_slot_as_booked(self):
        self._book()
        response = self.client.get(
            reverse("availability"), {"date": self.monday.isoformat()}
        )
        slot = next(s for s in response.data["slots"] if s["time"] == "09:00")
        self.assertEqual(slot["status"], "booked")

    def test_double_booking_is_rejected_with_friendly_message(self):
        first = self._book()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self._book(patient_name="Second Patient")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        message = str(second.data["appointment_time"][0])
        self.assertIn("available appointment time", message)

    def test_cancelled_slot_can_be_rebooked(self):
        first = self._book()
        appointment_id = first.data["id"]

        appointment = Appointment.objects.get(id=appointment_id)
        appointment.status = Appointment.Status.CANCELLED
        appointment.save()

        second = self._book(patient_name="Second Patient")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

    def test_booking_outside_working_hours_is_rejected(self):
        response = self._book(time="18:00")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_appointment_list_requires_authentication(self):
        response = self.client.get(reverse("appointment-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_dentist_can_list_appointments(self):
        self._book()
        user = get_user_model().objects.create_user(username="drtest", password="pw12345!")
        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("appointment-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
