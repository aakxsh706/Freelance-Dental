#!/usr/bin/env bash
# Offline install (macOS / Linux). Mirrors install-clinic.bat so the same
# flow can be tested here. Downloads nothing.
set -euo pipefail
cd "$(dirname "$0")"

[ -d vendor/wheels ] || { echo "vendor/wheels missing - incomplete copy"; exit 1; }
[ -f frontend/dist/index.html ] || { echo "frontend/dist missing - incomplete copy"; exit 1; }

echo "[1/5] Creating the Python environment"
[ -d backend/venv ] || python3 -m venv backend/venv

echo "[2/5] Installing packages from vendor/wheels"
# --no-index forbids pip from reaching the network at all.
backend/venv/bin/python -m pip install --no-index --find-links=vendor/wheels \
    -r backend/requirements-clinic.txt --quiet --disable-pip-version-check

echo "[3/5] Creating the settings file"
backend/venv/bin/python backend/make_env.py

echo "[4/5] Preparing the database"
backend/venv/bin/python backend/manage.py migrate --noinput
backend/venv/bin/python backend/manage.py seed_clinic

echo "[5/5] Collecting the web files"
DEBUG=False \
SECRET_KEY=setup-step-only-not-used-at-runtime-aaaaaaaaaaaaaaaaaaaaaa \
backend/venv/bin/python backend/manage.py collectstatic --noinput --clear >/dev/null

echo
echo "Installed. Nothing was downloaded. Start with: ./start-clinic.sh"
