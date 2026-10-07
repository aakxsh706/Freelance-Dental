"""Human-readable patient numbering.

Patients are referred to by `patient_code` (BEL-000001) on paperwork and over
the phone, and by `uuid` in URLs. Neither is the integer pk: the pk stays
internal so the API never leaks how many patients the clinic has, and the
code stays readable so staff can say it out loud.
"""

import re

from django.db import IntegrityError, transaction

PATIENT_CODE_PREFIX = "BEL"
PATIENT_CODE_DIGITS = 6
_CODE_RE = re.compile(rf"^{PATIENT_CODE_PREFIX}-(\d{{{PATIENT_CODE_DIGITS}}})$")


def format_patient_code(number: int) -> str:
    return f"{PATIENT_CODE_PREFIX}-{number:0{PATIENT_CODE_DIGITS}d}"


def _highest_code_number(model) -> int:
    """Largest numeric suffix currently in use.

    Ordering on the string column is safe because the suffix is zero-padded to
    a fixed width, so lexical and numeric order agree.
    """
    latest = (
        model.objects.filter(patient_code__startswith=f"{PATIENT_CODE_PREFIX}-")
        .order_by("-patient_code")
        .values_list("patient_code", flat=True)
        .first()
    )
    if not latest:
        return 0
    match = _CODE_RE.match(latest)
    return int(match.group(1)) if match else 0


def next_patient_code(model) -> str:
    return format_patient_code(_highest_code_number(model) + 1)


def create_with_patient_code(model, **fields):
    """Create a patient, allocating the next free code.

    Two bookings landing at once can compute the same next code, so the unique
    index is the real arbiter and a collision simply retries with a recomputed
    value rather than handing out a duplicate. Each attempt is its own
    savepoint: a failed INSERT must not poison an outer transaction.
    """
    attempts = 10
    for attempt in range(attempts):
        code = fields.get("patient_code") or next_patient_code(model)
        try:
            with transaction.atomic():
                return model.objects.create(**{**fields, "patient_code": code})
        except IntegrityError:
            # Only a racing code collision is retryable; if the caller pinned an
            # explicit code, the conflict is theirs to resolve.
            if fields.get("patient_code") or attempt == attempts - 1:
                raise
    raise RuntimeError("Could not allocate a unique patient code.")
