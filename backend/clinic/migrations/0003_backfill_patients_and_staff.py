"""Give every pre-existing appointment a Patient, and the dentist a staff role.

Before this migration an appointment carried a name and phone number and
nothing else; there was no patient record to attach it to. Rather than leave
that history orphaned, this groups the existing rows by normalised phone (then
email) and creates one patient per distinct person, so the clinic software
opens with a populated directory and complete appointment histories instead of
an empty one.

Grouping rules are intentionally the same conservative ones the live matcher
uses: identifiers only, never names. Rows with no usable identifier each get
their own patient - splitting one person into two records is recoverable by
merging, while collapsing two people is not.
"""

import re
import uuid

from django.db import migrations

LOCAL_NUMBER_LENGTH = 10
PATIENT_CODE_PREFIX = "BEL"
PATIENT_CODE_DIGITS = 6


def normalize_phone(raw):
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if len(digits) < LOCAL_NUMBER_LENGTH:
        return ""
    return digits[-LOCAL_NUMBER_LENGTH:]


def normalize_email(raw):
    return raw.strip().lower() if raw else ""


def split_name(raw):
    cleaned = (raw or "").strip()
    first, _, last = cleaned.partition(" ")
    return (first or cleaned or "Unknown"), last.strip()


def backfill(apps, schema_editor):
    Appointment = apps.get_model("clinic", "Appointment")
    Patient = apps.get_model("clinic", "Patient")
    StaffProfile = apps.get_model("clinic", "StaffProfile")
    Dentist = apps.get_model("clinic", "Dentist")

    next_number = 1
    # Oldest first: the earliest booking supplies the patient's canonical name.
    groups = {}
    ungrouped = []

    for appointment in Appointment.objects.order_by("created_at", "id"):
        phone_key = normalize_phone(appointment.phone)
        email_key = normalize_email(appointment.email)
        key = f"p:{phone_key}" if phone_key else (f"e:{email_key}" if email_key else None)
        if key is None:
            ungrouped.append(appointment)
        else:
            groups.setdefault(key, []).append(appointment)

    def create_patient(sample):
        nonlocal next_number
        first, last = split_name(sample.patient_name)
        code = f"{PATIENT_CODE_PREFIX}-{next_number:0{PATIENT_CODE_DIGITS}d}"
        next_number += 1
        display = " ".join(part for part in [first, last] if part)
        return Patient.objects.create(
            uuid=uuid.uuid4(),
            patient_code=code,
            first_name=first,
            last_name=last,
            display_name=display,
            phone=sample.phone or "",
            email=sample.email or "",
            phone_normalized=normalize_phone(sample.phone),
            email_normalized=normalize_email(sample.email),
            country="India",
            is_active=True,
        )

    linked = 0
    for appointments in groups.values():
        patient = create_patient(appointments[0])
        ids = [a.id for a in appointments]
        Appointment.objects.filter(id__in=ids).update(
            patient=patient, match_status="linked"
        )
        linked += len(ids)

    for appointment in ungrouped:
        patient = create_patient(appointment)
        Appointment.objects.filter(id=appointment.id).update(
            patient=patient, match_status="created"
        )
        linked += 1

    # Whoever runs the clinic today must not lose access when roles arrive.
    seen_users = set()
    for dentist in Dentist.objects.select_related("user"):
        if dentist.user_id in seen_users:
            continue
        seen_users.add(dentist.user_id)
        StaffProfile.objects.get_or_create(
            user_id=dentist.user_id,
            defaults={"full_name": dentist.name, "role": "dentist", "is_active": True},
        )


def unbackfill(apps, schema_editor):
    """Reverse cleanly: detach appointments, then drop what this created.

    Appointments keep their name/phone/email snapshot, so unapplying loses no
    booking information.
    """
    Appointment = apps.get_model("clinic", "Appointment")
    Patient = apps.get_model("clinic", "Patient")
    StaffProfile = apps.get_model("clinic", "StaffProfile")

    Appointment.objects.update(patient=None, match_status="unmatched")
    Patient.objects.all().delete()
    StaffProfile.objects.filter(role="dentist").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("clinic", "0002_allergy_auditlog_clinicalvisit_dentalhistory_and_more"),
    ]

    operations = [migrations.RunPython(backfill, unbackfill)]
