#!/usr/bin/env bash
# Dr. Belin's Dentistry - start the clinic software (macOS / Linux).
# The same single-process bundle the Windows .bat runs, for testing here.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
# This machine only. See start-clinic.bat for how to open it to the LAN.
LISTEN="${LISTEN:-127.0.0.1}"

[ -x backend/venv/bin/python ] || { echo "Not built yet - run ./build-clinic.sh"; exit 1; }
[ -f frontend/dist/index.html ] || { echo "Frontend not built - run ./build-clinic.sh"; exit 1; }
[ -f backend/.env ] || { echo "backend/.env missing - copy backend/.env.example to it"; exit 1; }

echo
echo "  Clinic software:  http://localhost:$PORT"
echo "  Staff login:      http://localhost:$PORT/clinic/login"
echo "  Ctrl+C to stop."
echo

backend/venv/bin/python backend/manage.py migrate --noinput
cd backend
exec venv/bin/waitress-serve --host="$LISTEN" --port="$PORT" config.wsgi:application
