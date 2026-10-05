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

"$PY" backend/manage.py migrate --noinput >/dev/null
exec "$PY" backend/run_server.py
