#!/usr/bin/env bash
# Vercel build step.
#
# A serverless function has no shell, so everything normally run by hand after
# a deploy happens here, while the build container still has network access to
# the database and the environment variables are present.
#
# PY exists so this same script can be exercised locally against a virtualenv.
set -euo pipefail

PY="${PY:-python3}"

echo "--> Installing Python packages"
# Vercel installs requirements.txt for the FUNCTION, not necessarily for the
# build container, so manage.py would not find Django without this.
"$PY" -m pip install --quiet --disable-pip-version-check -r requirements.txt

echo "--> Building the frontend"
cd frontend
npm ci --silent 2>/dev/null || npm install --silent
npm run build
cd ..

echo "--> Collecting static files"
"$PY" backend/manage.py collectstatic --noinput --clear

echo "--> Applying database migrations"
# Failing the build is the right outcome: deploying code whose schema does not
# match the database leaves a clinical system half-migrated, which is worse
# than not deploying at all.
"$PY" backend/manage.py migrate --noinput

echo "--> Seeding the clinic (first deploy only)"
# Idempotent - creates the dentist login, clinic details and working hours
# only when they are not already there.
"$PY" backend/manage.py seed_clinic

echo "--> Build complete"
