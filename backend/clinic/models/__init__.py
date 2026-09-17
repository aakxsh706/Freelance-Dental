"""Model package for the clinic app.

Split by concern rather than kept in one module: the public website only cares
about `clinic_config` and `scheduling`, while the internal clinic software
works mostly in `patients` and `clinical`. Everything is re-exported here so
`from clinic.models import X` keeps working exactly as before the split.
"""

from .appointment_events import AppointmentHistory, AppointmentNotification
from .audit import AuditLog
from .base import TimeStampedModel, UUIDModel
from .clinic_config import BlockedDate, ClinicSettings, Dentist, DentistAvailability
from .clinical import (
    ClinicalVisit,
    PatientDocument,
    Prescription,
    PrescriptionItem,
    Treatment,
)
from .patients import (
    Allergy,
    DentalHistory,
    FamilyMedicalHistory,
    Hospitalization,
    MedicalCondition,
    MedicalProfile,
    PastSurgery,
    Patient,
    PatientMedication,
)
from .scheduling import Appointment
from .staff import StaffProfile

__all__ = [
    "Allergy",
    "Appointment",
    "AppointmentHistory",
    "AppointmentNotification",
    "AuditLog",
    "BlockedDate",
    "ClinicSettings",
    "ClinicalVisit",
    "DentalHistory",
    "Dentist",
    "DentistAvailability",
    "FamilyMedicalHistory",
    "Hospitalization",
    "MedicalCondition",
    "MedicalProfile",
    "PastSurgery",
    "Patient",
    "PatientDocument",
    "PatientMedication",
    "Prescription",
    "PrescriptionItem",
    "StaffProfile",
    "TimeStampedModel",
    "Treatment",
    "UUIDModel",
]
