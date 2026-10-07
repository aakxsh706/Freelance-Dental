# Deploying to Vercel

The clinic PC stays as it is. This is a second, internet-facing copy with its
own database — the two do not share data.

## What you upload

**Nothing by hand.** Vercel deploys from GitHub, and there is no build step:
the frontend bundle and Django's static files are committed, so Vercel only
imports the Python function and serves it.

| File | Purpose |
|---|---|
| `vercel.json` | Routes every request to the Python function |
| `api/index.py` | The entry point Vercel imports |
| `requirements.txt` | Python packages, at the root where Vercel looks |
| `frontend/dist/` | The built website, committed |
| `backend/staticfiles/` | What Django serves, committed |

`vercel-build.sh` is **not** run by Vercel. Run it yourself after changing the
frontend, then commit what it produces:

```bash
./vercel-build.sh
git add frontend/dist backend/staticfiles && git commit -m "Rebuild assets"
```

Every build-time task is a way a deploy can fail - installing packages,
reaching npm, importing Django, connecting to the database. The output is
identical every time, so it is produced on a machine where it can be checked.

## Migrations: run once, from your own machine

Not from the build. A build container that loses its database connection
halfway leaves a clinical schema half-applied.

With the Postgres connection string from the next section:

```bash
export DATABASE_URL='postgresql://...'
export SECRET_KEY='<the same one you set in Vercel>'
export DEBUG=False
export ALLOWED_HOSTS=localhost
backend/venv/bin/python backend/manage.py migrate
backend/venv/bin/python backend/manage.py seed_clinic
```

Do this once before the first deploy, and again whenever a release adds a
migration.

## Before you start: the database

Vercel wipes the filesystem between requests. SQLite there means every patient
and appointment is lost within minutes, **silently**.

So a Postgres database is not optional. `settings.py` refuses to start without
one rather than let that happen — if you see
*"DATABASE_URL is not set…"* in the deploy log, that guard is why.

Create one first:

- **Vercel Postgres** — in the project, Storage → Create → Postgres. Sets
  `DATABASE_URL` for you.
- **Neon** or **Supabase** — both have a free tier. Copy the connection string.

## Steps

**1.** Go to <https://vercel.com/new> and import the GitHub repository.

**2.** Framework Preset: **Other**. Leave the build settings alone —
`vercel.json` supplies them.

**3.** Add these Environment Variables (Settings → Environment Variables):

| Name | Value |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `SECRET_KEY` | Generate one, see below |
| `DEBUG` | `False` |
| `DENTIST_PASSWORD` | A real password for the first login |
| `EMAIL_HOST_USER` | `belindentistry@gmail.com` |
| `EMAIL_HOST_PASSWORD` | The Gmail app password |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` |
| `DEFAULT_FROM_EMAIL` | `Dr. Belin's Dentistry <belindentistry@gmail.com>` |

Generate the secret key:

```bash
python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'!@#\$%^&*(-_=+)') for _ in range(64)))"
```

`ALLOWED_HOSTS` is handled automatically — the deployment hostname changes
with every build, so `settings.py` reads `VERCEL_URL` rather than pinning it.

**4.** Deploy. The build log should show the six `-->` steps from
`vercel-build.sh` and end with `Build complete`.

**5.** Sign in at `https://<your-app>.vercel.app/clinic/login` with `drbelin`
and whatever you set `DENTIST_PASSWORD` to.

## What this copy cannot do

**Patient document uploads are disabled.** X-rays and scans are a `FileField`
writing to disk, and a serverless filesystem does not keep them — the upload
would return success and the file would be gone by the next request.

Rather than lose medical images silently, the endpoint refuses with a clear
message and a `503`. Reading existing records is unaffected. Upload documents
from the clinic PC instead.

To change that, patient documents need external storage (S3 or Cloudinary via
`django-storages`). Ask and I will wire it up.

**The Google Sheet sync has nowhere to run.** It is a management command, and
serverless has no shell or scheduler. Keep running it from the clinic PC,
which is where the patient records actually live.

## Two things to fix before real patients use this

**There is no rate limiting on login.** Failed attempts are recorded in the
audit trail but never blocked, so passwords can be guessed without limit.
Acceptable on a locked-down clinic PC; not on a public URL in front of
medical records.

**This is now internet-facing health data.** Under India's DPDP Act the
clinic carries specific obligations for it. Worth being deliberate about who
can reach this URL, rather than relying on nobody guessing it.
