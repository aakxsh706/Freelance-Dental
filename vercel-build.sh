#!/usr/bin/env bash
# Rebuild the committed assets. NOT run by Vercel.
#
# Vercel has no build step: frontend/dist and backend/staticfiles are built
# here and committed, because every build-time task is a way a deploy can
# fail. Installing packages, reaching npm, importing Django and connecting to
# the database all have to work in the build container, and none of them need
# to - the output is identical every time and can be produced on a machine
# where it is verifiable.
#
# Run this after changing the frontend, then commit what it produces.
set -euo pipefail
cd "$(dirname "$0")"

PY="${PY:-backend/venv/bin/python}"

echo "--> Building the frontend"
(cd frontend && npm install --silent && npm run build)

echo "--> Collecting static files"
DEBUG=False \
SECRET_KEY=build-step-only-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
SECURE_SSL_REDIRECT=False \
"$PY" backend/manage.py collectstatic --noinput --clear

echo
echo "Done. Commit frontend/dist and backend/staticfiles."
