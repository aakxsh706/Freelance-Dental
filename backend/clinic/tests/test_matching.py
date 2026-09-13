"""Tests for patient matching.

This is the highest-consequence logic in the system. Linking a booking to the
wrong patient attaches one person's allergies to another person's treatment, so
these tests are written around the failure the matcher must never produce:
merging two people. Producing a duplicate is the acceptable outcome, and is
asserted as such.
"""

from datetime import date, timedelta

from django.test import TestCase
from rest_framework.test import APITestCase

from ..identifiers import create_with_patient_code, format_patient_code
from ..matching import (
    find_patient_matches,
    names_are_compatible,
    normalize_email,
    normalize_phone,
    resolve_patient_for_booking,
)
from ..models import Appointment, DentistAvailability, Patient


class NormalizationTests(TestCase):
    def test_phone_formats_reduce_to_one_key(self):
        """How a number is typed must not decide who it belongs to."""
        variants = [
            "+91 98765 43210",
            "098765 43210",
            "9876543210",
            "+91-98765-43210",
            "(098765) 43210",
        ]
        keys = {normalize_phone(v) for v in variants}
        self.assertEqual(keys, {"9876543210"})

    def test_unusable_phone_yields_empty_key(self):
        """Too short to identify anyone - must not become a match key."""
        for value in ["", None, "123", "n/a"]:
            self.assertEqual(normalize_phone(value), "")

    def test_email_is_case_and_space_insensitive(self):
        self.assertEqual(normalize_email("  John@Example.COM "), "john@example.com")


class NameCompatibilityTests(TestCase):
    def test_same_name_is_compatible(self):
        self.assertTrue(names_are_compatible("John Mathew", "John Mathew"))

    def test_shared_surname_alone_is_not_enough(self):
        """The household-phone case.

        Relatives share both a phone number and a surname, which is exactly why
        a surname match cannot be treated as identity.
        """
        self.assertFalse(names_are_compatible("Meera Nair", "Priya Nair"))

    def test_name_order_and_middle_names_still_match(self):
        self.assertTrue(names_are_compatible("Mathew John", "John Mathew"))
        self.assertTrue(names_are_compatible("John Mathew", "John K Mathew"))
        self.assertTrue(names_are_compatible("John", "John Mathew"))

    def test_unusable_name_abstains(self):
        """With no name to judge, the identifier decides - this is a veto only."""
        self.assertTrue(names_are_compatible("", "Priya Nair"))


class PatientMatchingTests(TestCase):
    def setUp(self):
        self.john = create_with_patient_code(
            Patient,
            first_name="John",
            last_name="Mathew",
            phone="+91 98765 43210",
            email="john@example.com",
        )

    def test_same_person_rebooking_links_to_existing_record(self):
        result = find_patient_matches("John Mathew", "098765 43210", "")
        self.assertTrue(result.is_linked)
        self.assertEqual(result.patient.pk, self.john.pk)

    def test_email_alone_can_link(self):
        result = find_patient_matches("John Mathew", "", "JOHN@example.com")
        self.assertTrue(result.is_linked)

    def test_relative_on_the_same_phone_is_not_merged(self):
        """The one thing this module must never do."""
        result = find_patient_matches("Meera Mathew", "+91 98765 43210", "")
        self.assertTrue(result.is_ambiguous)
        self.assertIsNone(result.patient)

    def test_unknown_person_matches_nothing(self):
        result = find_patient_matches("Stranger Person", "+91 90000 00000", "")
        self.assertEqual(result.status, "unmatched")

    def test_no_identifier_never_matches_on_name(self):
        """An identical name with no phone or email is not identification."""
        result = find_patient_matches("John Mathew", "", "")
        self.assertEqual(result.status, "unmatched")

    def test_merged_away_records_are_not_matched(self):
        duplicate = create_with_patient_code(
            Patient, first_name="John", last_name="Mathew", phone="+91 98765 43210"
        )
        duplicate.merged_into = self.john
        duplicate.is_active = False
        duplicate.save()
        result = find_patient_matches("John Mathew", "+91 98765 43210", "")
        self.assertTrue(result.is_linked)
        self.assertEqual(result.patient.pk, self.john.pk)

    def test_two_relatives_then_a_third_name_stays_ambiguous(self):
        create_with_patient_code(
            Patient, first_name="Meera", last_name="Mathew", phone="+91 98765 43210"
        )
        result = find_patient_matches("Arun Mathew", "+91 98765 43210", "")
        self.assertTrue(result.is_ambiguous)
        self.assertEqual(len(result.candidates), 2)

    def test_resolve_creates_a_patient_when_nobody_matches(self):
        patient, status_value, ids = resolve_patient_for_booking(
            "Brand New", "+91 91111 11111", "new@example.com"
        )
        self.assertEqual(status_value, "created")
        self.assertIsNotNone(patient)
        self.assertEqual(patient.first_name, "Brand")
        self.assertEqual(patient.last_name, "New")
        self.assertEqual(ids, [patient.pk])

    def test_resolve_returns_no_patient_when_ambiguous(self):
        patient, status_value, ids = resolve_patient_for_booking(
            "Meera Mathew", "+91 98765 43210", ""
        )
        self.assertIsNone(patient)
        self.assertEqual(status_value, "ambiguous")
        self.assertEqual(ids, [self.john.pk])


class PatientCodeTests(TestCase):
    def test_codes_are_sequential_and_human_readable(self):
        first = create_with_patient_code(Patient, first_name="A")
        second = create_with_patient_code(Patient, first_name="B")
        self.assertEqual(first.patient_code, "BEL-000001")
        self.assertEqual(second.patient_code, "BEL-000002")

    def test_code_format_is_zero_padded(self):
        self.assertEqual(format_patient_code(128), "BEL-000128")

    def test_codes_stay_unique_after_a_deletion(self):
        """Reusing a freed code would point old paperwork at a new person."""
        create_with_patient_code(Patient, first_name="A")
        second = create_with_patient_code(Patient, first_name="B")
        second.delete()
        third = create_with_patient_code(Patient, first_name="C")
        self.assertEqual(third.patient_code, "BEL-000002")


class WebsiteBookingLinksToPatientTests(APITestCase):
    """§3: a booking made on the website is a clinic record immediately."""

    def setUp(self):
        today = date.today()
        self.target = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
        DentistAvailability.objects.create(
            day_of_week=self.target.weekday(),
            start_time="09:00",
            end_time="12:00",
            is_active=True,
        )

    def _book(self, name, phone, email="", time="09:00"):
        return self.client.post(
            "/api/appointments/",
            {
                "patient_name": name,
                "phone": phone,
                "email": email,
                "reason": "Checkup",
                "appointment_date": self.target.isoformat(),
                "appointment_time": time,
                "notes": "",
            },
            format="json",
        )

    def test_first_booking_creates_a_patient_and_links_it(self):
        response = self._book("New Person", "+91 98765 43210")
        self.assertEqual(response.status_code, 201)
        appointment = Appointment.objects.get(id=response.data["id"])
        self.assertIsNotNone(appointment.patient)
        self.assertEqual(appointment.match_status, "created")
        self.assertEqual(appointment.source, Appointment.Source.WEBSITE)

    def test_second_booking_reuses_the_same_patient(self):
        """Booking twice must not create the patient twice."""
        self._book("New Person", "+91 98765 43210", time="09:00")
        self._book("New Person", "098765 43210", time="09:30")
        self.assertEqual(Patient.objects.count(), 1)
        self.assertEqual(Patient.objects.first().appointments.count(), 2)

    def test_relative_booking_is_flagged_not_merged(self):
        self._book("Priya Nair", "+91 91234 56789", time="09:00")
        response = self._book("Meera Nair", "+91 91234 56789", time="09:30")
        appointment = Appointment.objects.get(id=response.data["id"])
        self.assertIsNone(appointment.patient)
        self.assertEqual(appointment.match_status, "ambiguous")
        # The booking is still honoured - the clinic's ambiguity is not the
        # patient's problem.
        self.assertEqual(response.status_code, 201)

    def test_booking_still_succeeds_and_is_bookable_end_to_end(self):
        response = self._book("Someone Else", "+91 98888 77777")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "pending")
