#!/usr/bin/env bash
# Build the bundle (macOS / Linux). Needs the internet; running it afterwards
# does not. Mirrors build-clinic.bat.
set -euo pipefail
cd "$(dirname "$0")"

echo "[1/6] Python environment"
[ -d backend/venv ] || python3 -m venv backend/venv
backend/venv/bin/pip install --upgrade pip --quiet
backend/venv/bin/pip install -r backend/requirements.txt --quiet

echo "[2/6] Frontend packages"
(cd frontend && npm install --silent)

echo "[3/6] Building the web app"
(cd frontend && npm run build)

echo "[4/6] Settings file"
backend/venv/bin/python backend/make_env.py

echo "[5/6] Database"
backend/venv/bin/python backend/manage.py migrate --noinput

# Dentist login, clinic details and working hours on a fresh database.
# Leaves an existing clinic's data alone, so rebuilding is safe.
backend/venv/bin/python backend/manage.py seed_clinic

echo "[6/6] Collecting files to serve"
# Throwaway key for this step only; the real one lives in backend/.env.
DEBUG=False \
SECRET_KEY=build-step-only-not-used-at-runtime-aaaaaaaaaaaaaaaaaaaa \
backend/venv/bin/python backend/manage.py collectstatic --noinput --clear

echo
echo "Build complete. Start with: ./start-clinic.sh"
