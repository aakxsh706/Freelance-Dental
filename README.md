# Belin's Dental Clinic

A public dental clinic website with online booking, and an internal clinic
management system for the dentist and staff — **one Django backend, one
database**. A booking made on the website is a clinic record the instant it is
saved; there is no import, export or synchronisation step between the two.

```
  PUBLIC WEBSITE                         CLINIC MANAGEMENT APP
  /  /appointment  ...                   /clinic/*  (staff login required)
          │                                        │
          └──────────────► DJANGO REST API ◄───────┘
                                  │
                          CENTRAL DATABASE
              patients · appointments · medical history
              visits · treatments · prescriptions
              documents · staff · audit logs
```

## Running it

Two processes. Backend first.

```bash
# Backend — http://127.0.0.1:4545
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env                    # SQLite by default; set DATABASE_URL for Postgres
./venv/bin/python manage.py migrate
./venv/bin/python manage.py seed_clinic # dentist login, clinic settings, working hours
./venv/bin/python manage.py runserver 127.0.0.1:4545
```

```bash
# Frontend — http://localhost:6565
cd frontend
npm install
cp .env.example .env
npm run dev
```

Sign in at `/clinic/login` with the credentials `seed_clinic` reports
(`DENTIST_USERNAME` / `DENTIST_PASSWORD` in `backend/.env`).

```bash
cd backend  && ./venv/bin/python manage.py test clinic   # 124 tests
cd frontend && npx tsc -b && npx oxlint && npm run build
```

## Layout

```
backend/clinic/
  models/        clinic_config · patients · scheduling · clinical · staff · audit
  serializers/   same split
  views/         public · scheduling · patients · clinical · dashboard · settings
  matching.py    connecting a website booking to the right patient
  availability.py  the single definition of "is this slot free"
  appointment_events.py  one place that records an appointment event
  notifications.py       queueing and sending patient emails
  permissions.py role-based access
  audit.py       writing the access trail

frontend/src/
  pages/            public website (unchanged)
  pages/clinic/     the clinic management app
  components/clinic/  sidebar shell, shared controls, patient alerts
```

## Things worth knowing before you change something

**Patient matching is deliberately cautious.** `matching.py` links a booking to
an existing patient only on a phone number or email — never on a name — and a
shared surname is explicitly not enough to merge two people, because relatives
share both phone numbers and surnames. When more than one patient plausibly
matches, the appointment is saved and flagged for staff rather than guessed at.
Creating a duplicate is recoverable by merging; merging two people is not.

**An appointment and a clinical visit are different things.** An appointment is
scheduling and can be cancelled or missed. A `ClinicalVisit` is the record of an
encounter that actually happened. Most visits come from an appointment, but a
walk-in has a visit with no appointment.

**Two different status lists, on purpose.** `SLOT_RELEASING_STATUSES`
(cancelled, no-show) is about whether a time is free to rebook.
`OPEN_STATUSES` (pending, confirmed, checked-in) is about whether something is
still going to happen. A completed appointment still held its slot but is not
upcoming. Both live on the `Appointment` model so the database constraint and
`availability.py` cannot drift apart.

**Appointment snapshots are intentional duplication.** An appointment keeps the
`patient_name`/`phone`/`email` typed at booking time alongside the `patient`
foreign key. Editing a patient's phone number years later must not rewrite the
contact details on a historical appointment.

**The appointment list is unpaginated unless you ask for a page.** The original
dashboard expects a bare JSON array from `/api/appointments/`. Pagination is
opt-in per request (`?page=1`) via `OptInPageNumberPagination`; switching it on
globally would break that caller.

**A request is not a booking.** A public booking creates a `pending`
*request*; the status is set by the backend and a `status` in the payload is
ignored. The public confirmation screen says "Appointment Request Submitted",
labels the date and time as *requested*, and states plainly that the patient is
not booked until the clinic confirms. The acknowledgement email says the same -
it is a receipt, not a confirmation.

**The originally requested time is kept.** `requested_date`/`requested_time` are
frozen at booking and never move, while `appointment_date`/`appointment_time`
are the current schedule. The clinic routinely approves a request at a
different time than the one asked for, so the confirmation email reads the
appointment *as it stands at send time* and, when they differ, says "you
originally requested 10:30, you are confirmed for 11:30".

**Declining a request is not cancelling an appointment.** Someone who was never
given an appointment is told the clinic could not fit them, not that their
appointment was cancelled - the second implies they had one and reads as a
rebuke for something they did not do. Separate template, separate notification
type.

**Plain-text emails render through a second template engine** with autoescaping
off (`using="text"`). Left on, a clinic called "Belin's Dental Clinic" reaches
the patient as `Belin&#x27;s`. The HTML alternative keeps the escaping engine,
and is always an alternative - never the only version.

**The appointment is authoritative; the email is a side effect.** Confirming,
rescheduling or cancelling writes to the database inside a transaction, commits,
and only then attempts the patient's email. A failure to send never rolls back
a change the clinic has already made, so every action returns two separate
facts - what the database did and what the email did - and the interface
reports them independently. `AppointmentNotification` records what was owed and
what happened to it, keyed so that confirming twice emails once while two
genuinely different reschedules both send.

**Appointment emails carry administrative information only.** Who, when, where,
and how to reach the clinic. Never a diagnosis, clinical note, prescription or
medical history: email is unencrypted in transit to an address that may be
shared, and none of that is needed to tell someone their appointment moved.
There is a test that fails if clinical text leaks into a confirmation.

**Scheduled time and arrival time are different facts.** `appointment_time` is
what was agreed; `checked_in_at` is when the person actually walked in.
Checking in never overwrites the schedule - a patient booked at 10:30 who
arrives at 11:15 still had a 10:30 appointment, and the gap between the two is
the clinic's running-late figure. The same separation continues into
`ClinicalVisit`, which has its own start and completion times.

**A slot conflict is answered with 409, not 400.** The request was well formed;
the slot is simply taken. The response names the appointment already in it, so
staff can pick another time or override deliberately. An override requires a
reason, is exempted from the uniqueness constraint (the constraint exists to
stop *accidental* double-booking), and is recorded in the appointment's
history. Permission comes either from a dentist/admin role or from the explicit
`clinic.override_appointment_slot` permission, which can be granted to a
trusted receptionist in the admin without promoting them to a clinical role.

**Walk-ins do not reserve a slot.** A walk-in is stamped with the clock time
the person came through the door, which is not a bookable slot and must not
block one - and two people may walk in during the same minute. They are
excluded from both the uniqueness constraint and the availability calculation,
consistently.

**AppointmentHistory and AuditLog are not duplicates.** AuditLog is the
compliance trail across every model, with IP and user agent, and nobody reads
it during a normal day. AppointmentHistory is a product feature: typed columns
so the timeline can render "20 Sep 10:30 -> 21 Sep 11:30" without parsing JSON.
Both are written from `clinic/appointment_events.py` so they cannot drift.

**Reads are audited, not just writes.** For medical records, "who opened this
patient's file" is the question that matters after the fact. `AuditLog` is
append-only and read-only through the API and the admin.

**Roles gate clinical data.** Reception can schedule and maintain contact
details but cannot open examination notes, diagnoses or prescriptions. The API
enforces this; the interface uses the same capability flags only to avoid
offering an action that would be refused.

## Email

**By default nothing is sent.** With `DEBUG=True` the mail backend is Django's
console backend: messages are composed in full and printed to the terminal
running the backend, so the whole workflow can be exercised without an SMTP
server and a development machine can never email a real patient by accident.

Because Django reports a *successful send* for that backend, the clinic screens
distinguish "sent" from "actually delivered" and say plainly when no mail
server is configured - otherwise staff see "confirmation email sent" and
reasonably assume the patient has it.

To send real email, set in `backend/.env` and restart the backend:

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST_USER=clinic@example.com
EMAIL_HOST_PASSWORD=<app password>
DEFAULT_FROM_EMAIL=Belin's Dental Clinic <clinic@example.com>
```

Gmail rejects ordinary account passwords; create an App Password at
<https://myaccount.google.com/apppasswords> (2-Step Verification must be on).
`DEFAULT_FROM_EMAIL` should be the authenticated address, or Google rewrites
or rejects it.

Check the configuration without booking anything:

```bash
./venv/bin/python manage.py send_test_email you@example.com
```

Message wording lives in `clinic/templates/clinic/email/` as paired plain-text
and HTML templates, so the clinic can reword them without touching Python.

## Production

`DEBUG=False` refuses to boot with a placeholder or short `SECRET_KEY`, and
turns on HSTS, secure cookies and SSL redirect. Set `DATABASE_URL` for Postgres
and `CORS_ALLOWED_ORIGINS` to the real frontend origin.

Patient documents upload to `MEDIA_ROOT`. Django serves them in development
only — in production they are patient records and must be served by the web
server behind an access check, never from an open directory.
