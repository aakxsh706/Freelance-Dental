from django.contrib import admin

from .models import Appointment, BlockedDate, ClinicSettings, Dentist, DentistAvailability


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
        "appointment_date",
        "appointment_time",
        "status",
        "phone",
    ]
    list_filter = ["status", "appointment_date"]
    search_fields = ["patient_name", "phone", "email"]
