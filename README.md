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
cd backend  && ./venv/bin/python manage.py test clinic   # 64 tests
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

**Reads are audited, not just writes.** For medical records, "who opened this
patient's file" is the question that matters after the fact. `AuditLog` is
append-only and read-only through the API and the admin.

**Roles gate clinical data.** Reception can schedule and maintain contact
details but cannot open examination notes, diagnoses or prescriptions. The API
enforces this; the interface uses the same capability flags only to avoid
offering an action that would be refused.

## Production

`DEBUG=False` refuses to boot with a placeholder or short `SECRET_KEY`, and
turns on HSTS, secure cookies and SSL redirect. Set `DATABASE_URL` for Postgres
and `CORS_ALLOWED_ORIGINS` to the real frontend origin.

Patient documents upload to `MEDIA_ROOT`. Django serves them in development
only — in production they are patient records and must be served by the web
server behind an access check, never from an open directory.
