import uuid

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Adds a stable, non-enumerable public identifier.

    Internal foreign keys keep using the integer pk; `uuid` is what the API
    exposes, so a patient record can't be walked by incrementing an integer
    in the URL. Required for anything carrying patient-identifiable data.
    """

    uuid = models.UUIDField(
        default=uuid.uuid4, editable=False, unique=True, db_index=True
    )

    class Meta:
        abstract = True
