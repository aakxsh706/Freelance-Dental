"""Vercel entry point.

Vercel's Python runtime imports this file and looks for a WSGI callable named
`app`. Everything else about the project is unchanged - this is a thin shim,
not a second copy of the configuration.

The Django project lives in backend/, which is not importable from here by
default, so it is put on sys.path before anything from it is imported.

Note what this deployment cannot do, because it is serverless:
  * the filesystem is wiped between requests, so the database must be
    Postgres (DATABASE_URL) and never the SQLite default;
  * patient document uploads need external storage - see
    PATIENT_DOCUMENTS_ENABLED in settings.py;
  * there is no shell, so migrations run from the build command in
    vercel.json rather than by hand.
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()

# Vercel's runtime has accepted either name across versions; exporting both
# costs nothing and removes a class of "handler not found" deploy failure.
application = app
