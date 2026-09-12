from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AppointmentViewSet,
    AvailabilityView,
    BlockedDateViewSet,
    ClinicSettingsView,
    DashboardStatsView,
    DentistAvailabilityViewSet,
    DentistProfileView,
)

router = DefaultRouter()
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register(
    "dentist/availability", DentistAvailabilityViewSet, basename="dentist-availability"
)
router.register("dentist/blocked-dates", BlockedDateViewSet, basename="blocked-date")

urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("availability/", AvailabilityView.as_view(), name="availability"),
    path("dentist/profile/", DentistProfileView.as_view(), name="dentist-profile"),
    path("dentist/stats/", DashboardStatsView.as_view(), name="dentist-stats"),
    path("clinic/settings/", ClinicSettingsView.as_view(), name="clinic-settings"),
    path("", include(router.urls)),
]
