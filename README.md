# Dr. Belin's Dentistry - clinic portal

The hosted copy: public booking site and staff portal, served by Django on
Vercel with a Postgres database.

This is deliberately separate from the offline Windows bundle, which lives in
the main repository and remains the clinic's system of record. The two have
their own databases and do not share data.

## Deploying

See **DEPLOY-VERCEL.md** - it has the full click-by-click walkthrough.

In short: create a Postgres database, import this repository at
<https://vercel.com/new>, set the environment variables, deploy.

## Layout

```
api/index.py        the entry point Vercel imports
vercel.json         routes every request to that function
vercel-build.sh     installs packages, builds the frontend, migrates, seeds
requirements.txt    Python packages, at the root where Vercel looks
backend/            the Django application
frontend/           the React app (built during deployment)
docs/               the Google Sheet webhook script
```

## Running it locally

```bash
python3 -m venv backend/venv
backend/venv/bin/pip install -r requirements.txt
cp backend/.env.example backend/.env    # then fill in SECRET_KEY
backend/venv/bin/python backend/manage.py migrate
backend/venv/bin/python backend/manage.py seed_clinic
(cd frontend && npm install && npm run dev)
backend/venv/bin/python backend/manage.py runserver 127.0.0.1:4545
```

## Two limits of the hosted copy

**Patient document uploads are off.** X-rays are files on disk, and a
serverless host does not keep them. The endpoint refuses with a clear message
rather than accepting an upload it cannot store. Upload from the clinic PC.

**The Google Sheet sync has nowhere to run.** It is a management command and
serverless has no scheduler. Run it from the clinic PC.
