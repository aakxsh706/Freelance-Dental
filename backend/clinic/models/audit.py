from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Append-only trail of who touched which record.

    Medical records need read auditing, not just write auditing - "who opened
    this patient's file" is the question that matters after the fact - so
    VIEW is a first-class action here alongside the mutations.

    Rows are never updated or deleted through the application; the API exposes
    this model read-only.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Created"
        UPDATE = "update", "Updated"
        DELETE = "delete", "Deleted"
        VIEW = "view", "Viewed"
        LOGIN = "login", "Signed in"
        LOGIN_FAILED = "login_failed", "Failed sign-in"
        LOGOUT = "logout", "Signed out"
        MERGE = "merge", "Merged"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    username = models.CharField(
        max_length=150,
        blank=True,
        help_text="Captured at write time so the trail survives the user being deleted.",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=64, blank=True)
    object_repr = models.CharField(max_length=255, blank=True)
    patient = models.ForeignKey(
        "clinic.Patient",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        help_text="Set when the action concerned a specific patient, so a per-patient access history can be shown.",
    )
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["-timestamp"]),
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["patient", "-timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.timestamp:%Y-%m-%d %H:%M} {self.username} {self.action} {self.model_name}"
