from django.contrib import admin

from .models import (
    Allergy,
    Appointment,
    AuditLog,
    BlockedDate,
    ClinicSettings,
    ClinicalVisit,
    DentalHistory,
    Dentist,
    DentistAvailability,
    FamilyMedicalHistory,
    Hospitalization,
    MedicalCondition,
    MedicalProfile,
    PastSurgery,
    Patient,
    PatientDocument,
    PatientMedication,
    Prescription,
    PrescriptionItem,
    StaffProfile,
    Treatment,
)


@admin.register(Dentist)
class DentistAdmin(admin.ModelAdmin):
    list_display = ["name", "title", "email", "phone"]


@admin.register(ClinicSettings)
class ClinicSettingsAdmin(admin.ModelAdmin):
    list_display = ["clinic_name", "phone", "address", "slot_duration_minutes"]


@admin.register(DentistAvailability)
class DentistAvailabilityAdmin(admin.ModelAdmin):
    list_display = ["get_day_of_week_display", "start_time", "end_time", "is_active"]
    list_filter = ["day_of_week", "is_active"]

    @admin.display(description="Day")
    def get_day_of_week_display(self, obj):
        return obj.get_day_of_week_display()


@admin.register(BlockedDate)
class BlockedDateAdmin(admin.ModelAdmin):
    list_display = ["date", "reason"]


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = [
        "patient_name",
        "patient",
        "appointment_date",
        "appointment_time",
        "status",
        "source",
        "phone",
    ]
    list_filter = ["status", "source", "match_status", "appointment_date"]
    search_fields = ["patient_name", "phone", "email", "patient__patient_code"]
    autocomplete_fields = ["patient"]


class AllergyInline(admin.TabularInline):
    model = Allergy
    extra = 0


class MedicalConditionInline(admin.TabularInline):
    model = MedicalCondition
    extra = 0


class PatientMedicationInline(admin.TabularInline):
    model = PatientMedication
    extra = 0


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ["patient_code", "full_name", "phone", "email", "is_active", "created_at"]
    list_filter = ["is_active", "gender", "created_at"]
    search_fields = ["patient_code", "first_name", "last_name", "display_name", "phone", "email"]
    readonly_fields = ["uuid", "patient_code", "phone_normalized", "email_normalized"]
    inlines = [AllergyInline, MedicalConditionInline, PatientMedicationInline]


@admin.register(MedicalProfile)
class MedicalProfileAdmin(admin.ModelAdmin):
    list_display = ["patient", "smoking_status", "alcohol_use", "pregnancy_status"]
    search_fields = ["patient__patient_code", "patient__first_name", "patient__last_name"]


@admin.register(DentalHistory)
class DentalHistoryAdmin(admin.ModelAdmin):
    list_display = ["patient", "oral_hygiene", "last_dental_visit"]
    search_fields = ["patient__patient_code", "patient__first_name", "patient__last_name"]


class TreatmentInline(admin.TabularInline):
    model = Treatment
    extra = 0


@admin.register(ClinicalVisit)
class ClinicalVisitAdmin(admin.ModelAdmin):
    list_display = ["visit_date", "patient", "status", "diagnosis"]
    list_filter = ["status", "visit_date"]
    search_fields = ["patient__patient_code", "patient__first_name", "chief_complaint", "diagnosis"]
    autocomplete_fields = ["patient"]
    inlines = [TreatmentInline]


@admin.register(Treatment)
class TreatmentAdmin(admin.ModelAdmin):
    list_display = ["name", "patient", "tooth_number", "status", "performed_date"]
    list_filter = ["status"]
    search_fields = ["name", "patient__patient_code"]
    autocomplete_fields = ["patient"]


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 1


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ["prescribed_date", "patient"]
    search_fields = ["patient__patient_code", "patient__first_name"]
    autocomplete_fields = ["patient"]
    inlines = [PrescriptionItemInline]


@admin.register(PatientDocument)
class PatientDocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "patient", "document_type", "created_at"]
    list_filter = ["document_type"]
    search_fields = ["title", "patient__patient_code"]
    autocomplete_fields = ["patient"]


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ["full_name", "user", "role", "is_active"]
    list_filter = ["role", "is_active"]
    search_fields = ["full_name", "user__username"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only in the admin as well - the trail is worthless if it can be edited."""

    list_display = ["timestamp", "username", "action", "model_name", "object_repr"]
    list_filter = ["action", "model_name", "timestamp"]
    search_fields = ["username", "object_repr"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


for model in (PastSurgery, Hospitalization, FamilyMedicalHistory):
    admin.site.register(model)
