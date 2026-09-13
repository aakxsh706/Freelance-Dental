from datetime import date as date_cls

from django.db import models

from .base import TimeStampedModel, UUIDModel


class Patient(UUIDModel, TimeStampedModel):
    """The person. One row per human, reused across every appointment.

    `phone_normalized` / `email_normalized` are denormalised lookup keys kept
    in sync on save: matching a website booking to an existing patient has to
    be an indexed equality test, not a scan with per-row cleanup.
    """

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"
        UNDISCLOSED = "undisclosed", "Prefer not to say"

    class BloodGroup(models.TextChoices):
        A_POS = "A+", "A+"
        A_NEG = "A-", "A-"
        B_POS = "B+", "B+"
        B_NEG = "B-", "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"
        O_POS = "O+", "O+"
        O_NEG = "O-", "O-"
        UNKNOWN = "unknown", "Unknown"

    patient_code = models.CharField(max_length=20, unique=True, db_index=True)

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    display_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Falls back to first + last name when left empty.",
    )

    phone = models.CharField(max_length=30, blank=True)
    alternate_phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)

    phone_normalized = models.CharField(max_length=20, blank=True, db_index=True)
    email_normalized = models.EmailField(blank=True, db_index=True)

    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=Gender.choices, blank=True)
    blood_group = models.CharField(max_length=10, choices=BloodGroup.choices, blank=True)

    address_line_1 = models.CharField(max_length=200, blank=True)
    address_line_2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True, default="India")

    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    emergency_contact_relationship = models.CharField(max_length=100, blank=True)

    occupation = models.CharField(max_length=150, blank=True)
    preferred_language = models.CharField(max_length=50, blank=True)

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    merged_into = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="merged_from",
        help_text="Set when this record was merged into another; kept for audit trail.",
    )

    class Meta:
        ordering = ["first_name", "last_name"]
        indexes = [
            models.Index(fields=["last_name", "first_name"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.patient_code})"

    @property
    def full_name(self) -> str:
        if self.display_name:
            return self.display_name
        return " ".join(part for part in [self.first_name, self.last_name] if part)

    @property
    def age(self) -> int | None:
        if not self.date_of_birth:
            return None
        today = date_cls.today()
        had_birthday = (today.month, today.day) >= (
            self.date_of_birth.month,
            self.date_of_birth.day,
        )
        return today.year - self.date_of_birth.year - (0 if had_birthday else 1)

    def save(self, *args, **kwargs):
        from ..matching import normalize_email, normalize_phone

        self.phone_normalized = normalize_phone(self.phone)
        self.email_normalized = normalize_email(self.email)
        if not self.display_name:
            self.display_name = " ".join(
                part for part in [self.first_name, self.last_name] if part
            )
        super().save(*args, **kwargs)


class MedicalProfile(TimeStampedModel):
    """The handful of medical facts that are single-valued per patient.

    Everything with a history (allergies, conditions, medications) lives in its
    own table; only lifestyle flags that can't repeat belong here.
    """

    class SmokingStatus(models.TextChoices):
        NEVER = "never", "Never smoked"
        FORMER = "former", "Former smoker"
        CURRENT = "current", "Current smoker"
        UNKNOWN = "unknown", "Not recorded"

    class AlcoholUse(models.TextChoices):
        NEVER = "never", "Never"
        OCCASIONAL = "occasional", "Occasional"
        REGULAR = "regular", "Regular"
        FORMER = "former", "Former"
        UNKNOWN = "unknown", "Not recorded"

    class PregnancyStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not applicable"
        NOT_PREGNANT = "not_pregnant", "Not pregnant"
        PREGNANT = "pregnant", "Pregnant"
        BREASTFEEDING = "breastfeeding", "Breastfeeding"
        UNKNOWN = "unknown", "Not recorded"

    patient = models.OneToOneField(
        Patient, on_delete=models.CASCADE, related_name="medical_profile"
    )
    smoking_status = models.CharField(
        max_length=20, choices=SmokingStatus.choices, default=SmokingStatus.UNKNOWN
    )
    alcohol_use = models.CharField(
        max_length=20, choices=AlcoholUse.choices, default=AlcoholUse.UNKNOWN
    )
    pregnancy_status = models.CharField(
        max_length=20,
        choices=PregnancyStatus.choices,
        default=PregnancyStatus.NOT_APPLICABLE,
    )
    other_notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"Medical profile for {self.patient.full_name}"


class Allergy(TimeStampedModel):
    """Surfaced as a red banner on the patient header - severity drives ranking."""

    class Severity(models.TextChoices):
        MILD = "mild", "Mild"
        MODERATE = "moderate", "Moderate"
        SEVERE = "severe", "Severe"
        LIFE_THREATENING = "life_threatening", "Life-threatening"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="allergies"
    )
    substance = models.CharField(max_length=150)
    reaction = models.CharField(max_length=255, blank=True)
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.MODERATE
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_active", "substance"]
        verbose_name_plural = "Allergies"

    def __str__(self) -> str:
        return f"{self.substance} ({self.get_severity_display()})"


class MedicalCondition(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MANAGED = "managed", "Managed"
        RESOLVED = "resolved", "Resolved"
        UNKNOWN = "unknown", "Not recorded"

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="medical_conditions"
    )
    condition = models.CharField(max_length=200)
    diagnosed_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-diagnosed_date", "condition"]

    def __str__(self) -> str:
        return self.condition


class PatientMedication(TimeStampedModel):
    """What the patient is already taking - distinct from what we prescribe."""

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="medications"
    )
    medication_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, blank=True)
    frequency = models.CharField(max_length=100, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_active", "medication_name"]

    def __str__(self) -> str:
        return self.medication_name


class PastSurgery(TimeStampedModel):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="surgeries"
    )
    procedure = models.CharField(max_length=200)
    surgery_date = models.DateField(null=True, blank=True)
    year = models.CharField(
        max_length=10, blank=True, help_text="Used when the exact date is unknown."
    )
    hospital = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-surgery_date", "-year"]
        verbose_name_plural = "Past surgeries"

    def __str__(self) -> str:
        return self.procedure


class Hospitalization(TimeStampedModel):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="hospitalizations"
    )
    reason = models.CharField(max_length=200)
    admitted_date = models.DateField(null=True, blank=True)
    discharged_date = models.DateField(null=True, blank=True)
    hospital = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-admitted_date"]

    def __str__(self) -> str:
        return self.reason


class FamilyMedicalHistory(TimeStampedModel):
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="family_history"
    )
    relationship = models.CharField(
        max_length=100, help_text="Mother, father, sibling, and so on."
    )
    condition = models.CharField(max_length=200)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["relationship", "condition"]
        verbose_name_plural = "Family medical history"

    def __str__(self) -> str:
        return f"{self.relationship}: {self.condition}"


class DentalHistory(TimeStampedModel):
    """Dental-specific background, one row per patient.

    Every field is optional by design: intake happens over several visits and a
    half-filled dental history is normal, not an error state.
    """

    class OralHygiene(models.TextChoices):
        EXCELLENT = "excellent", "Excellent"
        GOOD = "good", "Good"
        FAIR = "fair", "Fair"
        POOR = "poor", "Poor"
        UNKNOWN = "unknown", "Not recorded"

    class BrushingFrequency(models.TextChoices):
        TWICE_DAILY = "twice_daily", "Twice daily"
        ONCE_DAILY = "once_daily", "Once daily"
        IRREGULAR = "irregular", "Irregular"
        UNKNOWN = "unknown", "Not recorded"

    patient = models.OneToOneField(
        Patient, on_delete=models.CASCADE, related_name="dental_history"
    )

    previous_treatments = models.TextField(blank=True)
    last_dental_visit = models.DateField(null=True, blank=True)

    oral_hygiene = models.CharField(
        max_length=20, choices=OralHygiene.choices, default=OralHygiene.UNKNOWN
    )
    brushing_frequency = models.CharField(
        max_length=20,
        choices=BrushingFrequency.choices,
        default=BrushingFrequency.UNKNOWN,
    )
    flosses = models.BooleanField(null=True, blank=True)

    tooth_sensitivity = models.BooleanField(null=True, blank=True)
    tooth_sensitivity_notes = models.CharField(max_length=255, blank=True)
    bleeding_gums = models.BooleanField(null=True, blank=True)
    gum_disease = models.BooleanField(null=True, blank=True)
    bruxism = models.BooleanField(null=True, blank=True)

    orthodontic_history = models.BooleanField(null=True, blank=True)
    orthodontic_notes = models.CharField(max_length=255, blank=True)

    has_implants = models.BooleanField(null=True, blank=True)
    has_crowns = models.BooleanField(null=True, blank=True)
    has_bridges = models.BooleanField(null=True, blank=True)
    has_dentures = models.BooleanField(null=True, blank=True)

    root_canal_history = models.TextField(blank=True)
    extractions = models.TextField(blank=True)
    dental_material_reactions = models.TextField(
        blank=True, help_text="Reactions to latex, anaesthetic, metals and similar."
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Dental history"

    def __str__(self) -> str:
        return f"Dental history for {self.patient.full_name}"
