"""Serializer package for the clinic app.

Re-exported flat so existing imports (`from clinic.serializers import X`)
continue to resolve after the split into modules.
"""

from .audit import AuditLogSerializer, StaffProfileSerializer
from .clinic_config import (
    AvailableSlotSerializer,
    BlockedDateSerializer,
    ClinicSettingsSerializer,
    DentistAvailabilitySerializer,
    DentistSerializer,
)
from .clinical import (
    ClinicalVisitListSerializer,
    ClinicalVisitSerializer,
    CompleteVisitSerializer,
    PatientDocumentSerializer,
    PrescriptionItemSerializer,
    PrescriptionSerializer,
    TreatmentSerializer,
)
from .patients import (
    AllergySerializer,
    DentalHistorySerializer,
    FamilyMedicalHistorySerializer,
    HospitalizationSerializer,
    MedicalConditionSerializer,
    MedicalProfileSerializer,
    PastSurgerySerializer,
    PatientListSerializer,
    PatientMedicationSerializer,
    PatientMergePreviewSerializer,
    PatientSerializer,
)
from .scheduling import (
    AppointmentCreateSerializer,
    AppointmentResolvePatientSerializer,
    AppointmentSerializer,
    AppointmentStatusUpdateSerializer,
    PatientBriefSerializer,
    StaffAppointmentWriteSerializer,
)

__all__ = [
    "AllergySerializer",
    "AppointmentCreateSerializer",
    "AppointmentResolvePatientSerializer",
    "AppointmentSerializer",
    "AppointmentStatusUpdateSerializer",
    "AuditLogSerializer",
    "AvailableSlotSerializer",
    "BlockedDateSerializer",
    "ClinicSettingsSerializer",
    "ClinicalVisitListSerializer",
    "ClinicalVisitSerializer",
    "CompleteVisitSerializer",
    "DentalHistorySerializer",
    "DentistAvailabilitySerializer",
    "DentistSerializer",
    "FamilyMedicalHistorySerializer",
    "HospitalizationSerializer",
    "MedicalConditionSerializer",
    "MedicalProfileSerializer",
    "PastSurgerySerializer",
    "PatientBriefSerializer",
    "PatientDocumentSerializer",
    "PatientListSerializer",
    "PatientMedicationSerializer",
    "PatientMergePreviewSerializer",
    "PatientSerializer",
    "PrescriptionItemSerializer",
    "PrescriptionSerializer",
    "StaffAppointmentWriteSerializer",
    "StaffProfileSerializer",
    "TreatmentSerializer",
]
