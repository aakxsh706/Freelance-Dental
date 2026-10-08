from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import Appointment, DentistAvailability, StaffProfile


def next_weekday(target_weekday: int) -> date:
    today = date.today()
    days_ahead = (target_weekday - today.weekday()) % 7
    days_ahead = days_ahead or 7
    return today + timedelta(days=days_ahead)


class StaffBookingAndListTests(APITestCase):
    """Appointment creation is staff-only now: the public website's own
    unauthenticated booking (and the availability endpoint it read) moved to
    a separate, differently-authenticated service and no longer lives here.
    """

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
        self.staff_user = get_user_model().objects.create_user(
            username="frontdesk", password="pw12345!"
        )
        StaffProfile.objects.create(
            user=self.staff_user, full_name="Front Desk", role=StaffProfile.Role.RECEPTIONIST
        )

    def _book(self, time="09:00", **overrides):
        # Creation requires clinic staff now; there is no public caller left.
        self.client.force_authenticate(self.staff_user)
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

    def test_double_booking_is_rejected_with_a_named_conflict(self):
        """Staff booking surfaces a conflict (409, who holds the slot)
        rather than the public serializer's plain 400 - that serializer no
        longer backs this endpoint, so the response shape follows suit."""
        first = self._book()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self._book(patient_name="Second Patient")
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("already occupied", second.data["detail"])

    def test_cancelled_slot_can_be_rebooked(self):
        first = self._book()
        appointment_id = first.data["id"]

        appointment = Appointment.objects.get(id=appointment_id)
        appointment.status = Appointment.Status.CANCELLED
        appointment.save()

        second = self._book(patient_name="Second Patient")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

    def test_appointment_list_requires_authentication(self):
        response = self.client.get(reverse("appointment-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_staff_can_list_appointments(self):
        self._book()
        user = get_user_model().objects.create_user(username="drtest", password="pw12345!")
        # Listing appointments now requires a clinic staff role, not merely a
        # login. Reception is the lowest role that schedules, so it is the
        # right floor for this endpoint.
        StaffProfile.objects.create(
            user=user, full_name="Dr Test", role=StaffProfile.Role.RECEPTIONIST
        )
        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("appointment-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_login_without_a_staff_profile_cannot_read_appointments(self):
        """A bare account is not a clinic account.

        Patient data must not be reachable just because someone has any valid
        login; access is granted by role.
        """
        self._book()
        user = get_user_model().objects.create_user(username="nobody", password="pw12345!")
        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("appointment-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_appointment_list_is_an_array_without_a_page_parameter(self):
        """The original dashboard expects a bare array.

        Pagination was added for the clinic software; this guards the old
        contract against it being switched on globally.
        """
        self._book()
        user = get_user_model().objects.create_user(username="drtest2", password="pw12345!")
        StaffProfile.objects.create(
            user=user, full_name="Dr Test", role=StaffProfile.Role.DENTIST
        )
        self.client.force_authenticate(user=user)
        response = self.client.get(reverse("appointment-list"))
        self.assertIsInstance(response.data, list)

        paged = self.client.get(reverse("appointment-list"), {"page": 1})
        self.assertIn("results", paged.data)
        self.assertIn("count", paged.data)

    def test_no_show_releases_the_slot(self):
        """A missed appointment frees its time, like a cancellation.

        (Previously also checked the public /api/availability/ endpoint
        reflected this; that endpoint moved out with the public website, so
        this now checks the only thing that still matters here - the slot
        is rebookable.)
        """
        first = self._book()
        appointment = Appointment.objects.get(id=first.data["id"])
        appointment.status = Appointment.Status.NO_SHOW
        appointment.save()

        second = self._book(patient_name="Second Patient")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
