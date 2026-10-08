"""View package for the clinic app.

Re-exported flat so `from clinic.views import X` keeps resolving after the
split into modules.
"""

from .clinical import (
    ClinicalVisitViewSet,
    PatientDocumentViewSet,
    PrescriptionViewSet,
    TreatmentViewSet,
)
from .dashboard import (
    AuditLogViewSet,
    CurrentStaffView,
    DashboardStatsView,
    TodayQueueView,
    UpcomingAppointmentsView,
)
from .patients import (
    AllergyViewSet,
    FamilyMedicalHistoryViewSet,
    HospitalizationViewSet,
    MedicalConditionViewSet,
    PastSurgeryViewSet,
    PatientMedicationViewSet,
    PatientViewSet,
)
from .public import (
    AuditedTokenObtainPairView,
    ClinicSettingsView,
    DentistProfileView,
)
from .scheduling import AppointmentViewSet
from .settings_views import BlockedDateViewSet, DentistAvailabilityViewSet

__all__ = [
    "AllergyViewSet",
    "AppointmentViewSet",
    "AuditLogViewSet",
    "AuditedTokenObtainPairView",
    "BlockedDateViewSet",
    "ClinicSettingsView",
    "ClinicalVisitViewSet",
    "CurrentStaffView",
    "DashboardStatsView",
    "DentistAvailabilityViewSet",
    "DentistProfileView",
    "FamilyMedicalHistoryViewSet",
    "HospitalizationViewSet",
    "MedicalConditionViewSet",
    "PastSurgeryViewSet",
    "PatientDocumentViewSet",
    "PatientMedicationViewSet",
    "PatientViewSet",
    "PrescriptionViewSet",
    "TodayQueueView",
    "TreatmentViewSet",
    "UpcomingAppointmentsView",
]
