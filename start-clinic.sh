#!/usr/bin/env bash
# Start the clinic software (macOS / Linux). Mirrors start-clinic.bat.
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
export PORT="${PORT:-8000}"
export LISTEN="${LISTEN:-127.0.0.1}"
export PYTHONPATH="$PWD/runtime/lib:$PWD/backend"

[ -d runtime/lib ] || { echo "Not installed - run ./install-clinic.sh"; exit 1; }
[ -f backend/.env ] || { echo "Not installed - run ./install-clinic.sh"; exit 1; }

# Checks GitHub for a newer release and installs it before anything else
# starts. Always offline-safe - see backend/update_check.py.
"$PY" backend/update_check.py

"$PY" backend/manage.py migrate --noinput >/dev/null

# Picks up any bookings already waiting in the Google Sheet before the
# clinic opens for the day - same offline-safe reasoning as update_check.py.
# run_server.py repeats this every few minutes while the software stays
# open, so this is just so a booking does not wait for the next restart.
"$PY" backend/manage.py poll_appointment_sheet

exec "$PY" backend/run_server.py
