from django.conf import settings
from django.db import models


class Dentist(models.Model):
    """The single dentist profile. There is only ever one row of this model."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dentist"
    )
    name = models.CharField(max_length=150, default="Dr. Belin Roshia")
    title = models.CharField(
        max_length=150, default="Dentist & Oral Healthcare Professional"
    )
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    bio = models.TextField(blank=True)
    profile_image = models.CharField(
        max_length=500,
        blank=True,
        help_text="URL or static path to the dentist's photo. Placeholder until the client provides one.",
    )

    def __str__(self) -> str:
        return self.name


class ClinicSettings(models.Model):
    """Singleton-style model holding clinic-wide contact/location info."""

    clinic_name = models.CharField(max_length=200, default="Dr. Belin's Dentistry")
    phone = models.CharField(max_length=30, default="+91 88707 74432")
    email = models.EmailField(blank=True, default="belindentistry@gmail.com")
    address = models.CharField(
        max_length=300,
        default=(
            "No. 23, SS Towers, Kurumbapalayam, Sathy road, "
            "Sarkarsamakulam PO, Coimbatore 641107, Tamilnadu"
        ),
    )
    google_maps_embed_url = models.URLField(
        blank=True,
        max_length=500,
        default=(
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d500!2d77.0214229!3d11.1014248!2m3!"
            "1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba8f94e0565a521%3A0x4741f01b6c83c8b3!2sDr.%"
            "20Belin%27s%20Dentistry!5e0!3m2!1sen!2sin!4v1759150000000!5m2!1sen!2sin"
        ),
        help_text="Google Maps embed URL (src of an <iframe>), from Share > Embed a map.",
    )
    google_maps_url = models.URLField(
        blank=True,
        default="https://maps.app.goo.gl/1sA41VZLgnzXNse86",
        help_text="Link to open the clinic location in Google Maps.",
    )
    slot_duration_minutes = models.PositiveIntegerField(default=30)

    class Meta:
        verbose_name = "Clinic settings"
        verbose_name_plural = "Clinic settings"

    def __str__(self) -> str:
        return self.clinic_name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "ClinicSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class DentistAvailability(models.Model):
    """A recurring working-hours block for a given day of the week.

    Multiple rows per day are allowed to express split shifts
    (e.g. 09:00-13:00 and 16:00-20:00 on the same day).
    """

    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    day_of_week = models.IntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        verbose_name_plural = "Dentist availability"

    def __str__(self) -> str:
        return f"{self.get_day_of_week_display()} {self.start_time}-{self.end_time}"


class BlockedDate(models.Model):
    """A single calendar date the dentist is unavailable (holiday, leave, etc.)."""

    date = models.DateField(unique=True)
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["date"]

    def __str__(self) -> str:
        return f"{self.date} ({self.reason})" if self.reason else str(self.date)
