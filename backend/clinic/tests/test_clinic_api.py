"""Tests for the internal clinic software: roles, records and the visit flow."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from ..identifiers import create_with_patient_code
from ..models import (
    Allergy,
    Appointment,
    AuditLog,
    ClinicalVisit,
    Patient,
    StaffProfile,
)


def make_staff(username, role):
    user = get_user_model().objects.create_user(username=username, password="pw12345!")
    StaffProfile.objects.create(user=user, full_name=username, role=role)
    return user


class RolePermissionTests(APITestCase):
    """Reception can run the front desk; only clinicians see clinical data."""

    def setUp(self):
        self.patient = create_with_patient_code(
            Patient, first_name="Test", last_name="Patient", phone="+91 90000 00001"
        )
        self.dentist = make_staff("dentist1", StaffProfile.Role.DENTIST)
        self.receptionist = make_staff("reception1", StaffProfile.Role.RECEPTIONIST)

    def test_receptionist_can_use_the_front_desk(self):
        self.client.force_authenticate(self.receptionist)
        self.assertEqual(self.client.get("/api/appointments/").status_code, 200)
        self.assertEqual(self.client.get("/api/patients/").status_code, 200)

    def test_receptionist_cannot_read_clinical_records(self):
        self.client.force_authenticate(self.receptionist)
        for path in [
            f"/api/visits/?patient={self.patient.uuid}",
            f"/api/allergies/?patient={self.patient.uuid}",
            f"/api/prescriptions/?patient={self.patient.uuid}",
            "/api/audit-logs/",
        ]:
            self.assertEqual(self.client.get(path).status_code, 403, path)

    def test_receptionist_cannot_change_clinic_settings(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.patch(
            "/api/clinic/settings/", {"phone": "+91 99999 99999"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_dentist_can_read_clinical_records(self):
        self.client.force_authenticate(self.dentist)
        response = self.client.get(f"/api/visits/?patient={self.patient.uuid}")
        self.assertEqual(response.status_code, 200)

    def test_capabilities_are_reported_for_the_current_user(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["can_view_clinical"])
        self.assertFalse(response.data["can_prescribe"])


class PatientDirectoryTests(APITestCase):
    def setUp(self):
        self.user = make_staff("dentist2", StaffProfile.Role.DENTIST)
        self.client.force_authenticate(self.user)
        create_with_patient_code(
            Patient, first_name="John", last_name="Mathew",
            phone="+91 98765 43210", email="john@example.com",
        )
        create_with_patient_code(
            Patient, first_name="Sarah", last_name="Joseph", phone="+91 90000 11111"
        )

    def test_directory_is_paginated(self):
        response = self.client.get("/api/patients/")
        self.assertIn("count", response.data)
        self.assertIn("results", response.data)

    def test_search_runs_on_the_server(self):
        """§14: searching must not require shipping the whole directory."""
        response = self.client.get("/api/patients/", {"search": "Mathew"})
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["full_name"], "John Mathew")

    def test_search_by_patient_code_and_email(self):
        self.assertEqual(
            self.client.get("/api/patients/", {"search": "BEL-000001"}).data["count"], 1
        )
        self.assertEqual(
            self.client.get("/api/patients/", {"search": "john@example.com"}).data["count"], 1
        )

    def test_search_ignores_phone_formatting(self):
        response = self.client.get("/api/patients/", {"search": "098765 43210"})
        self.assertEqual(response.data["count"], 1)

    def test_creating_a_patient_allocates_a_code(self):
        response = self.client.post(
            "/api/patients/", {"first_name": "Brand", "last_name": "New"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["patient_code"].startswith("BEL-"))

    def test_patient_code_cannot_be_set_by_the_client(self):
        response = self.client.post(
            "/api/patients/",
            {"first_name": "Spoof", "patient_code": "BEL-999999"},
            format="json",
        )
        self.assertNotEqual(response.data["patient_code"], "BEL-999999")


class PatientMergeTests(APITestCase):
    def setUp(self):
        self.user = make_staff("dentist3", StaffProfile.Role.DENTIST)
        self.client.force_authenticate(self.user)
        self.target = create_with_patient_code(Patient, first_name="John", last_name="Mathew")
        self.source = create_with_patient_code(
            Patient, first_name="Jon", last_name="Mathew", occupation="Teacher"
        )

    def test_merge_moves_records_and_tombstones_the_duplicate(self):
        Allergy.objects.create(patient=self.source, substance="Penicillin")
        response = self.client.post(
            f"/api/patients/{self.target.uuid}/merge/",
            {"source": str(self.source.uuid)},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.source.refresh_from_db()
        self.target.refresh_from_db()
        self.assertEqual(self.source.merged_into_id, self.target.pk)
        self.assertFalse(self.source.is_active)
        self.assertEqual(self.target.allergies.count(), 1)
        # Gaps are filled from the absorbed record.
        self.assertEqual(self.target.occupation, "Teacher")

    def test_merged_record_leaves_the_directory_but_not_the_database(self):
        self.client.post(
            f"/api/patients/{self.target.uuid}/merge/",
            {"source": str(self.source.uuid)}, format="json",
        )
        listing = self.client.get("/api/patients/", {"search": "Mathew"})
        self.assertEqual(listing.data["count"], 1)
        self.assertTrue(Patient.objects.filter(pk=self.source.pk).exists())

    def test_a_patient_cannot_be_merged_into_themselves(self):
        response = self.client.post(
            f"/api/patients/{self.target.uuid}/merge/",
            {"source": str(self.target.uuid)}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_merge_is_recorded_in_the_audit_trail(self):
        self.client.post(
            f"/api/patients/{self.target.uuid}/merge/",
            {"source": str(self.source.uuid)}, format="json",
        )
        self.assertTrue(AuditLog.objects.filter(action="merge").exists())


class ClinicalVisitWorkflowTests(APITestCase):
    """§18/§19: an appointment is scheduling, a visit is the medical record."""

    def setUp(self):
        self.user = make_staff("dentist4", StaffProfile.Role.DENTIST)
        self.client.force_authenticate(self.user)
        self.patient = create_with_patient_code(
            Patient, first_name="John", last_name="Mathew", phone="+91 98765 43210"
        )
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            patient_name="John Mathew",
            phone="+91 98765 43210",
            reason="Crown fitting",
            appointment_date=date.today(),
            appointment_time="09:00",
            status=Appointment.Status.CHECKED_IN,
        )

    def test_visit_starts_from_an_appointment_and_prefills_the_complaint(self):
        response = self.client.post(
            "/api/visits/start-from-appointment/",
            {"appointment": self.appointment.id}, format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["chief_complaint"], "Crown fitting")
        self.assertEqual(response.data["status"], "draft")

    def test_starting_twice_returns_the_same_visit(self):
        """A double click must not produce two records for one encounter."""
        first = self.client.post(
            "/api/visits/start-from-appointment/",
            {"appointment": self.appointment.id}, format="json",
        )
        second = self.client.post(
            "/api/visits/start-from-appointment/",
            {"appointment": self.appointment.id}, format="json",
        )
        self.assertEqual(first.data["uuid"], second.data["uuid"])
        self.assertEqual(ClinicalVisit.objects.count(), 1)

    def test_completing_a_visit_closes_the_appointment(self):
        visit = self.client.post(
            "/api/visits/start-from-appointment/",
            {"appointment": self.appointment.id}, format="json",
        ).data
        response = self.client.post(
            f"/api/visits/{visit['uuid']}/complete/",
            {"complete_appointment": True}, format="json",
        )
        self.assertEqual(response.data["status"], "completed")
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.status, Appointment.Status.COMPLETED)

    def test_a_visit_can_exist_without_an_appointment(self):
        """Walk-in emergencies have no scheduled slot."""
        response = self.client.post(
            "/api/visits/",
            {
                "patient": str(self.patient.uuid),
                "visit_date": date.today().isoformat(),
                "chief_complaint": "Walk-in, severe pain",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["appointment_id"])

    def test_one_appointment_cannot_have_two_visits(self):
        self.client.post(
            "/api/visits/start-from-appointment/",
            {"appointment": self.appointment.id}, format="json",
        )
        response = self.client.post(
            "/api/visits/",
            {
                "patient": str(self.patient.uuid),
                "visit_date": date.today().isoformat(),
                "appointment_id": self.appointment.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_prescription_requires_at_least_one_medication(self):
        response = self.client.post(
            "/api/prescriptions/",
            {
                "patient": str(self.patient.uuid),
                "prescribed_date": date.today().isoformat(),
                "items": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)


class AppointmentStatusTests(APITestCase):
    def setUp(self):
        self.user = make_staff("dentist5", StaffProfile.Role.DENTIST)
        self.client.force_authenticate(self.user)
        self.appointment = Appointment.objects.create(
            patient_name="Someone",
            phone="+91 98765 43210",
            reason="Checkup",
            appointment_date=date.today() + timedelta(days=3),
            appointment_time="09:00",
        )

    def _patch(self, status_value):
        return self.client.patch(
            f"/api/appointments/{self.appointment.id}/",
            {"status": status_value}, format="json",
        )

    def test_check_in_stamps_the_time(self):
        self._patch("confirmed")
        response = self._patch("checked_in")
        self.assertEqual(response.data["status"], "checked_in")
        self.assertIsNotNone(response.data["checked_in_at"])

    def test_completed_appointments_cannot_be_reopened(self):
        self._patch("confirmed")
        self._patch("completed")
        response = self._patch("pending")
        self.assertEqual(response.status_code, 400)

    def test_no_show_is_recordable(self):
        self._patch("confirmed")
        response = self._patch("no_show")
        self.assertEqual(response.data["status"], "no_show")


class AuditTrailTests(APITestCase):
    def setUp(self):
        self.user = make_staff("dentist6", StaffProfile.Role.DENTIST)
        self.client.force_authenticate(self.user)
        self.patient = create_with_patient_code(Patient, first_name="Audited", last_name="Person")

    def test_opening_a_patient_file_is_recorded(self):
        """Read access to medical records is auditable, not just writes."""
        self.client.get(f"/api/patients/{self.patient.uuid}/")
        self.assertTrue(
            AuditLog.objects.filter(
                action="view", model_name="Patient", patient=self.patient
            ).exists()
        )

    def test_edits_record_a_field_level_diff(self):
        self.client.patch(
            f"/api/patients/{self.patient.uuid}/", {"phone": "+91 91111 22222"}, format="json"
        )
        entry = AuditLog.objects.filter(action="update", model_name="Patient").first()
        self.assertIsNotNone(entry)
        self.assertIn("phone", entry.changes)

    def test_audit_entries_cannot_be_written_through_the_api(self):
        response = self.client.post("/api/audit-logs/", {"action": "view"}, format="json")
        self.assertIn(response.status_code, (403, 405))


class UpcomingSemanticsTests(APITestCase):
    """"Upcoming" means not yet done, which is not the same as "holds a slot".

    A completed appointment still occupied its slot, so it is not
    slot-releasing - but it must not be offered as something still to come.
    """

    def setUp(self):
        self.user = make_staff("dentist7", StaffProfile.Role.DENTIST)
        self.client.force_authenticate(self.user)
        self.patient = create_with_patient_code(Patient, first_name="Future", last_name="Person")
        future = date.today() + timedelta(days=5)
        self.completed = Appointment.objects.create(
            patient=self.patient, patient_name="Future Person", phone="+91 90000 00002",
            reason="Done already", appointment_date=future, appointment_time="09:00",
            status=Appointment.Status.COMPLETED,
        )
        self.open_one = Appointment.objects.create(
            patient=self.patient, patient_name="Future Person", phone="+91 90000 00002",
            reason="Still to come", appointment_date=future, appointment_time="10:00",
            status=Appointment.Status.CONFIRMED,
        )

    def test_completed_future_appointment_is_not_upcoming(self):
        response = self.client.get("/api/dentist/upcoming/", {"days": 30})
        ids = [row["id"] for row in response.data]
        self.assertIn(self.open_one.id, ids)
        self.assertNotIn(self.completed.id, ids)

    def test_upcoming_count_excludes_completed(self):
        response = self.client.get("/api/dentist/stats/")
        self.assertEqual(response.data["upcoming_count"], 1)

    def test_next_appointment_column_skips_completed(self):
        """The directory's "next appointment" must be something still to come."""
        response = self.client.get("/api/patients/", {"search": "Future"})
        row = response.data["results"][0]
        self.assertEqual(row["next_appointment_date"], self.open_one.appointment_date.isoformat())

    def test_completed_appointment_still_holds_its_slot(self):
        """The other half of the distinction: it is not bookable again."""
        clash = self.client.post(
            "/api/appointments/",
            {
                "patient": str(self.patient.uuid),
                "reason": "Clash",
                "appointment_date": self.completed.appointment_date.isoformat(),
                "appointment_time": "09:00",
            },
            format="json",
        )
        self.assertEqual(clash.status_code, 400)
