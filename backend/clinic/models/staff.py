from django.conf import settings
from django.db import models

from .base import TimeStampedModel


class StaffProfile(TimeStampedModel):
    """Role attached to a login.

    Roles gate clinical data: a receptionist schedules appointments and
    maintains contact details but never sees examination notes, diagnoses or
    prescriptions. Capability is expressed as named properties rather than
    role checks scattered through the permission classes, so adding a role
    later means editing this table only.
    """

    class Role(models.TextChoices):
        DENTIST = "dentist", "Dentist"
        ADMIN = "admin", "Administrator"
        ASSISTANT = "assistant", "Dental Assistant"
        RECEPTIONIST = "receptionist", "Receptionist"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_profile"
    )
    full_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.RECEPTIONIST
    )
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return f"{self.full_name or self.user.get_username()} ({self.get_role_display()})"

    @property
    def can_view_clinical(self) -> bool:
        return self.role in {self.Role.DENTIST, self.Role.ADMIN, self.Role.ASSISTANT}

    @property
    def can_edit_clinical(self) -> bool:
        return self.role in {self.Role.DENTIST, self.Role.ADMIN}

    @property
    def can_prescribe(self) -> bool:
        return self.role in {self.Role.DENTIST, self.Role.ADMIN}

    @property
    def can_manage_settings(self) -> bool:
        return self.role in {self.Role.DENTIST, self.Role.ADMIN}

    @property
    def can_view_audit(self) -> bool:
        return self.role in {self.Role.DENTIST, self.Role.ADMIN}

    @property
    def can_delete_records(self) -> bool:
        return self.role in {self.Role.DENTIST, self.Role.ADMIN}
