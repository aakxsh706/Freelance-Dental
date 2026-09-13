from django.conf import settings
from django.db import models

from .base import TimeStampedModel, UUIDModel
from .clinic_config import Dentist
from .patients import Patient
from .scheduling import Appointment


def patient_document_path(instance, filename: str) -> str:
    return f"patients/{instance.patient.uuid}/documents/{filename}"


class ClinicalVisit(UUIDModel, TimeStampedModel):
    """What actually happened, as opposed to what was scheduled.

    An Appointment is calendar information and can be cancelled or missed; a
    ClinicalVisit is the medical record of an encounter that took place. Most
    visits originate from an appointment, but a walk-in emergency has a visit
    with no appointment, so the link is optional on purpose.

    A visit stays `draft` while the dentist is still typing and becomes
    `completed` when signed off - only then is it treated as a final record.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "In progress"
        COMPLETED = "completed", "Completed"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="visits"
    )
    appointment = models.OneToOneField(
        Appointment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="visit",
    )
    provider = models.ForeignKey(
        Dentist, null=True, blank=True, on_delete=models.SET_NULL, related_name="visits"
    )

    visit_date = models.DateField()
    visit_time = models.TimeField(null=True, blank=True)

    chief_complaint = models.TextField(blank=True)
    history_of_present_illness = models.TextField(blank=True)
    clinical_examination = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    treatment_performed = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)
    follow_up_instructions = models.TextField(blank=True)
    next_visit_recommendation = models.TextField(blank=True)
    next_visit_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_visits",
    )

    class Meta:
        ordering = ["-visit_date", "-visit_time", "-created_at"]
        indexes = [models.Index(fields=["patient", "-visit_date"])]

    def __str__(self) -> str:
        return f"Visit {self.visit_date} - {self.patient.full_name}"


class Treatment(TimeStampedModel):
    """A procedure carried out or planned, optionally against a specific tooth.

    Kept as rows rather than prose inside the visit so that treatment history
    per tooth can be queried - "what has been done to 36" is a question staff
    ask constantly and a text field cannot answer.
    """

    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="treatments"
    )
    visit = models.ForeignKey(
        ClinicalVisit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="treatments",
    )
    name = models.CharField(max_length=200)
    tooth_number = models.CharField(
        max_length=20, blank=True, help_text="FDI notation, e.g. 36. Blank if not tooth-specific."
    )
    surfaces = models.CharField(
        max_length=20, blank=True, help_text="Tooth surfaces involved, e.g. MOD."
    )
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PLANNED
    )
    performed_date = models.DateField(null=True, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-performed_date", "-created_at"]
        indexes = [models.Index(fields=["patient", "-performed_date"])]

    def __str__(self) -> str:
        return f"{self.name}{f' ({self.tooth_number})' if self.tooth_number else ''}"


class Prescription(UUIDModel, TimeStampedModel):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="prescriptions"
    )
    visit = models.ForeignKey(
        ClinicalVisit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="prescriptions",
    )
    prescribed_by = models.ForeignKey(
        Dentist,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="prescriptions",
    )
    prescribed_date = models.DateField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_prescriptions",
    )

    class Meta:
        ordering = ["-prescribed_date", "-created_at"]
        indexes = [models.Index(fields=["patient", "-prescribed_date"])]

    def __str__(self) -> str:
        return f"Prescription {self.prescribed_date} - {self.patient.full_name}"


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name="items"
    )
    medication_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, blank=True)
    frequency = models.CharField(max_length=100, blank=True)
    duration = models.CharField(max_length=100, blank=True)
    instructions = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.medication_name


class PatientDocument(UUIDModel, TimeStampedModel):
    class DocumentType(models.TextChoices):
        XRAY = "xray", "X-ray"
        SCAN = "scan", "Scan"
        REPORT = "report", "Report"
        CONSENT = "consent", "Consent form"
        PHOTO = "photo", "Clinical photo"
        INVOICE = "invoice", "Invoice"
        OTHER = "other", "Other"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="documents"
    )
    visit = models.ForeignKey(
        ClinicalVisit,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    title = models.CharField(max_length=200)
    document_type = models.CharField(
        max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER
    )
    file = models.FileField(upload_to=patient_document_path)
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_documents",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title
