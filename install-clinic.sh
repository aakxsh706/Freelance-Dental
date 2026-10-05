#!/usr/bin/env bash
# Offline install (macOS / Linux) - mirrors install-clinic.bat so the same
# flow can be exercised here. Downloads nothing.
#
# Difference from Windows: there is no bundled interpreter for Unix, so this
# uses the system python3. The package install is identical - the wheels are
# unpacked, not pip-installed.
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || { echo "python3 not found"; exit 1; }

[ -d vendor/wheels ] || { echo "vendor/wheels missing - incomplete copy"; exit 1; }
[ -f frontend/dist/index.html ] || { echo "frontend/dist missing - incomplete copy"; exit 1; }

echo "[1/4] Installing packages (unpacking wheels, no pip)"
"$PY" vendor/unpack_wheels.py "$PWD/runtime/lib" >/dev/null

export PYTHONPATH="$PWD/runtime/lib:$PWD/backend"

echo "[2/4] Creating the settings file"
"$PY" backend/make_env.py

echo "[3/4] Preparing the database"
"$PY" backend/manage.py migrate --noinput >/dev/null
"$PY" backend/manage.py seed_clinic >/dev/null

echo "[4/4] Collecting the web files"
DEBUG=False \
SECRET_KEY=setup-step-only-not-used-at-runtime-aaaaaaaaaaaaaaaaaaaaaa \
"$PY" backend/manage.py collectstatic --noinput --clear >/dev/null

echo
echo "Installed. Nothing was downloaded. Start with: ./start-clinic.sh"
