"""Attaching a website booking to the right patient record.

The failure modes here are asymmetric, and the rules below are built around
that asymmetry:

  * Creating a duplicate patient is annoying but recoverable - staff merge the
    two records and nothing was lost.
  * Merging two different people into one record is a clinical safety
    incident. One person's allergy list is now attached to another person's
    treatment. It is not reliably recoverable, because once notes are written
    against the merged record you cannot tell which half they belong to.

So the matcher only ever links on an identifier a person owns - phone or email
- never on a name. Names are used solely to *veto* a match that identifiers
alone would have accepted (a shared family phone number), never to create one.
Anything it is not sure about is handed to staff as `ambiguous` rather than
guessed at.
"""

import re
import unicodedata

# Indian mobile numbers are 10 digits; comparing on the last 10 makes
# +91 98765 43210, 098765 43210 and 9876543210 the same key without having to
# guess at a country code.
LOCAL_NUMBER_LENGTH = 10


def normalize_phone(raw: str | None) -> str:
    """Reduce a typed phone number to a comparable key.

    Returns "" for anything too short to identify a person - an empty key must
    never match another empty key, so callers filter these out.
    """
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if len(digits) < LOCAL_NUMBER_LENGTH:
        return ""
    return digits[-LOCAL_NUMBER_LENGTH:]


def normalize_email(raw: str | None) -> str:
    if not raw:
        return ""
    return raw.strip().lower()


def normalize_name(raw: str | None) -> str:
    """Casefold and strip accents/punctuation so names compare sensibly."""
    if not raw:
        return ""
    decomposed = unicodedata.normalize("NFKD", raw)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z ]", " ", stripped.lower()).strip()


def name_tokens(raw: str | None) -> set[str]:
    return {token for token in normalize_name(raw).split() if len(token) > 1}


def names_are_compatible(a: str | None, b: str | None) -> bool:
    """True when two names could plausibly be the same person.

    Shared household phone numbers are common, so an identifier match with a
    clearly different name is treated as a different person. If either name is
    unusable, this abstains (returns True) and leaves the decision to the
    identifier - it is a veto, not a matcher.

    A shared *surname* is explicitly not enough. People who share a phone
    number are usually family, so "Meera Nair" and "Priya Nair" overlapping on
    "Nair" is evidence they are relatives, not evidence they are one person.
    Two names are compatible only when:

      * their first names agree - the usual case, "John Mathew" twice; or
      * one name's words are a subset of the other's, which covers a middle
        name appearing only sometimes ("John Mathew" / "John K Mathew") and
        the given/family order being swapped ("Mathew John" / "John Mathew").
    """
    tokens_a, tokens_b = name_tokens(a), name_tokens(b)
    if not tokens_a or not tokens_b:
        return True
    if tokens_a <= tokens_b or tokens_b <= tokens_a:
        return True
    first_a, first_b = first_name_token(a), first_name_token(b)
    return bool(first_a and first_b and first_a == first_b)


def first_name_token(raw: str | None) -> str:
    """The given name, used as the discriminator between relatives."""
    tokens = normalize_name(raw).split()
    meaningful = [token for token in tokens if len(token) > 1]
    return meaningful[0] if meaningful else ""


class MatchResult:
    """Outcome of looking for an existing patient.

    `status` mirrors Appointment.MatchStatus so the caller can store it
    directly: linked (one confident match), ambiguous (several - staff decide),
    or unmatched (none - caller may create).
    """

    def __init__(self, status: str, patient=None, candidates=None):
        self.status = status
        self.patient = patient
        self.candidates = list(candidates or [])

    @property
    def is_linked(self) -> bool:
        return self.status == "linked"

    @property
    def is_ambiguous(self) -> bool:
        return self.status == "ambiguous"

    def __repr__(self) -> str:
        return f"<MatchResult {self.status} patient={self.patient} candidates={len(self.candidates)}>"


def find_patient_matches(name: str, phone: str, email: str) -> MatchResult:
    """Look for the patient this booking belongs to.

    Only active, unmerged records are considered - a record that was merged
    away must not win a match against the record it was merged into.
    """
    from .models import Patient

    phone_key = normalize_phone(phone)
    email_key = normalize_email(email)

    if not phone_key and not email_key:
        return MatchResult("unmatched")

    base = Patient.objects.filter(is_active=True, merged_into__isnull=True)

    candidates: dict[int, Patient] = {}
    if phone_key:
        for patient in base.filter(phone_normalized=phone_key):
            candidates[patient.pk] = patient
    if email_key:
        for patient in base.filter(email_normalized=email_key):
            candidates[patient.pk] = patient

    if not candidates:
        return MatchResult("unmatched")

    if len(candidates) == 1:
        only = next(iter(candidates.values()))
        # A single identifier hit still has to survive the name veto: a family
        # sharing one phone number would otherwise collapse into one record.
        if names_are_compatible(name, only.full_name):
            return MatchResult("linked", patient=only, candidates=[only])
        return MatchResult("ambiguous", candidates=[only])

    # Several records share this phone or email. If exactly one of them also
    # agrees on the name, that is a confident match and the rest are household
    # members. Otherwise staff resolve it.
    by_name = [p for p in candidates.values() if names_are_compatible(name, p.full_name)]
    if len(by_name) == 1:
        return MatchResult("linked", patient=by_name[0], candidates=list(candidates.values()))

    return MatchResult("ambiguous", candidates=list(candidates.values()))


def build_patient_from_booking(name: str, phone: str, email: str):
    """Create the minimal patient record a website booking justifies.

    Only what the booking form actually collected - the clinic fills in the
    rest at the first visit. Split on the first space: without a separate
    surname field on the public form, guessing further would be worse than
    leaving last_name empty.
    """
    from .identifiers import create_with_patient_code
    from .models import Patient

    cleaned = (name or "").strip()
    first, _, last = cleaned.partition(" ")
    return create_with_patient_code(
        Patient,
        first_name=first or cleaned or "Unknown",
        last_name=last.strip(),
        phone=phone or "",
        email=email or "",
    )


def resolve_patient_for_booking(name: str, phone: str, email: str):
    """Find or create the patient for an incoming website booking.

    Returns (patient_or_None, match_status, candidate_ids). An ambiguous result
    deliberately returns no patient: the appointment is still saved and shows
    up in the clinic queue flagged for review, because refusing the booking
    would punish the patient for the clinic's duplicate records.
    """
    result = find_patient_matches(name, phone, email)

    if result.is_linked:
        return result.patient, "linked", [result.patient.pk]

    if result.is_ambiguous:
        return None, "ambiguous", [p.pk for p in result.candidates]

    patient = build_patient_from_booking(name, phone, email)
    return patient, "created", [patient.pk]
