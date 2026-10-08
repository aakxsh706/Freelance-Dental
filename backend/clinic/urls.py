from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AllergyViewSet,
    AppointmentViewSet,
    AuditLogViewSet,
    AuditedTokenObtainPairView,
    BlockedDateViewSet,
    ClinicSettingsView,
    ClinicalVisitViewSet,
    CurrentStaffView,
    DashboardStatsView,
    DentistAvailabilityViewSet,
    DentistProfileView,
    FamilyMedicalHistoryViewSet,
    HospitalizationViewSet,
    MedicalConditionViewSet,
    PastSurgeryViewSet,
    PatientDocumentViewSet,
    PatientMedicationViewSet,
    PatientViewSet,
    PrescriptionViewSet,
    TodayQueueView,
    TreatmentViewSet,
    UpcomingAppointmentsView,
)

router = DefaultRouter()

# Existing routes - paths unchanged so the public site and the original
# dashboard keep working exactly as before.
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register(
    "dentist/availability", DentistAvailabilityViewSet, basename="dentist-availability"
)
router.register("dentist/blocked-dates", BlockedDateViewSet, basename="blocked-date")

# Clinic management software.
router.register("patients", PatientViewSet, basename="patient")
router.register("visits", ClinicalVisitViewSet, basename="visit")
router.register("treatments", TreatmentViewSet, basename="treatment")
router.register("prescriptions", PrescriptionViewSet, basename="prescription")
router.register("documents", PatientDocumentViewSet, basename="document")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

# Per-patient medical history, each filtered by ?patient=<uuid>.
router.register("allergies", AllergyViewSet, basename="allergy")
router.register("medical-conditions", MedicalConditionViewSet, basename="medical-condition")
router.register("medications", PatientMedicationViewSet, basename="medication")
router.register("surgeries", PastSurgeryViewSet, basename="surgery")
router.register("hospitalizations", HospitalizationViewSet, basename="hospitalization")
router.register("family-history", FamilyMedicalHistoryViewSet, basename="family-history")

urlpatterns = [
    path("auth/login/", AuditedTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", CurrentStaffView.as_view(), name="current-staff"),
    path("dentist/profile/", DentistProfileView.as_view(), name="dentist-profile"),
    path("dentist/stats/", DashboardStatsView.as_view(), name="dentist-stats"),
    path("dentist/today/", TodayQueueView.as_view(), name="dentist-today"),
    path("dentist/upcoming/", UpcomingAppointmentsView.as_view(), name="dentist-upcoming"),
    path("clinic/settings/", ClinicSettingsView.as_view(), name="clinic-settings"),
    path("", include(router.urls)),
]
