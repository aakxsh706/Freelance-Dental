"""Role-based access for the internal clinic software.

The public site is unauthenticated and read-only against a narrow surface
(availability, clinic settings, dentist bio) plus booking. Everything added for
the clinic software sits behind these classes.

`staff_profile_for` treats a superuser or the configured dentist as full staff
even without an explicit StaffProfile row, so an existing deployment does not
lock its only user out the moment roles are introduced.
"""

from rest_framework import permissions

from .models import StaffProfile


def staff_profile_for(user) -> StaffProfile | None:
    if not user or not user.is_authenticated:
        return None
    profile = getattr(user, "staff_profile", None)
    if profile is not None:
        return profile if profile.is_active else None
    if user.is_superuser or hasattr(user, "dentist"):
        # Implicit full access; persisted on first use by ensure_staff_profile.
        return StaffProfile(
            user=user,
            full_name=user.get_full_name() or user.get_username(),
            role=StaffProfile.Role.DENTIST,
            is_active=True,
        )
    return None


def ensure_staff_profile(user) -> StaffProfile | None:
    """Persist the implicit profile above so roles can then be edited normally."""
    if not user or not user.is_authenticated:
        return None
    existing = getattr(user, "staff_profile", None)
    if existing is not None:
        return existing
    if user.is_superuser or hasattr(user, "dentist"):
        profile, _ = StaffProfile.objects.get_or_create(
            user=user,
            defaults={
                "full_name": user.get_full_name() or user.get_username(),
                "role": StaffProfile.Role.DENTIST,
            },
        )
        return profile
    return None


class IsClinicStaff(permissions.BasePermission):
    """Any active staff member. The floor for every internal endpoint."""

    message = "A clinic staff account is required."

    def has_permission(self, request, view):
        return staff_profile_for(request.user) is not None


class CanViewClinicalRecords(permissions.BasePermission):
    """Reading clinical content; writing additionally requires can_edit_clinical.

    Reception can schedule and maintain contact details all day without ever
    being able to open an examination note.
    """

    message = "Your role does not have access to clinical records."

    def has_permission(self, request, view):
        profile = staff_profile_for(request.user)
        if profile is None:
            return False
        if request.method in permissions.SAFE_METHODS:
            return profile.can_view_clinical
        return profile.can_edit_clinical


class CanPrescribe(permissions.BasePermission):
    message = "Only a dentist can issue or change prescriptions."

    def has_permission(self, request, view):
        profile = staff_profile_for(request.user)
        if profile is None:
            return False
        if request.method in permissions.SAFE_METHODS:
            return profile.can_view_clinical
        return profile.can_prescribe


class CanManageSettings(permissions.BasePermission):
    message = "Only a dentist or administrator can change clinic settings."

    def has_permission(self, request, view):
        profile = staff_profile_for(request.user)
        if profile is None:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return profile.can_manage_settings


class CanViewAudit(permissions.BasePermission):
    message = "Only a dentist or administrator can view the audit trail."

    def has_permission(self, request, view):
        profile = staff_profile_for(request.user)
        return profile is not None and profile.can_view_audit
