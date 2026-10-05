"""
Django settings for the Dr. Belin's Dentistry backend.
"""

from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="django-insecure-dev-only-change-me")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Keys that ship with the project and therefore are not secret. The value in
# .env.example counts: copying the example file is the normal way to set the
# backend up, so it is the placeholder most likely to reach production.
_PLACEHOLDER_SECRET_KEYS = {
    "django-insecure-dev-only-change-me",
    "change-this-to-a-long-random-string",
}

# This database holds patient medical records, so a guessable SECRET_KEY is not
# a warning to read later - it lets anyone mint a valid session or JWT. Refuse
# to boot rather than serve patient data with a known key.
if not DEBUG and (
    SECRET_KEY in _PLACEHOLDER_SECRET_KEYS
    or SECRET_KEY.startswith("django-insecure-")
    or len(SECRET_KEY) < 50
):
    raise ImproperlyConfigured(
        "SECRET_KEY is a placeholder or too short to be safe. Generate one with\n"
        "  python -c \"import secrets; print(secrets.token_urlsafe(64))\"\n"
        "and set it in the environment before running with DEBUG=False."
    )


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "clinic",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves the built frontend and Django admin assets without a separate
    # web server - the point of the single-process bundle.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
    {
        # Plain-text emails. Autoescaping is a defence against HTML injection
        # and has no meaning in a .txt body - left on, a clinic named
        # "Belin's Dental Clinic" reaches the patient as "Belin&#x27;s".
        # Rendered explicitly with using="text"; the HTML parts keep the
        # escaping engine above.
        "NAME": "text",
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"autoescape": False},
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases
# Defaults to SQLite for local development. Set DATABASE_URL in .env
# (e.g. postgres://USER:PASSWORD@HOST:5432/DBNAME) to use Postgres in production.

_database_url = env("DATABASE_URL", default="") or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {"default": environ.Env.db_url_config(_database_url)}


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = env("TIME_ZONE", default="Asia/Kolkata")
USE_I18N = True
USE_TZ = True


STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# The bundled build. `npm run build` writes here; Django serves it so a clinic
# PC runs one process on one port instead of a Python server, a Node server
# and a CORS configuration between them.
FRONTEND_BUILD_DIR = env(
    "FRONTEND_BUILD_DIR", default=str(BASE_DIR.parent / "frontend" / "dist")
)

# Vite emits hashed filenames under assets/. Collected into STATIC_ROOT so one
# WhiteNoise configuration serves both Django's own admin assets and the app.
if Path(FRONTEND_BUILD_DIR).exists():
    STATICFILES_DIRS = [Path(FRONTEND_BUILD_DIR)]

# Hashed, far-future-cacheable copies, and gzip for the slow clinic link.
# Only in production: the hashing manifest makes a missing file a hard error,
# which is unhelpful while developing.
if not DEBUG:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
        },
    }

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Django REST Framework

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("ACCESS_TOKEN_LIFETIME_MINUTES", default=60)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env.int("REFRESH_TOKEN_LIFETIME_DAYS", default=7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# CORS
# Never enable CORS_ALLOW_ALL_ORIGINS in production; restrict to the real
# frontend domain(s) via CORS_ALLOWED_ORIGINS in the environment.

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:6565", "http://127.0.0.1:6565"],
)
CORS_ALLOW_CREDENTIALS = True


# Email
# Appointment confirmations, reschedules and cancellations. Credentials come
# from the environment only - an SMTP password in source control is a password
# in every clone of the repository.
#
# Development defaults to the console backend, so the whole notification
# workflow (including the failure paths) can be exercised without an SMTP
# server and without ever emailing a real patient by accident.

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default=(
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=30)
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL", default="Dr. Belin's Dentistry <no-reply@belinsdental.example>"
)


# Patient sheet sync
# The clinic runs offline; patient contact details are pushed to a Google
# Sheet whenever a connection happens to exist. Both blank means the feature
# is off and the management command says so rather than failing obscurely.
# The URL is an Apps Script web app bound to the sheet; the token is the
# only thing guarding it, since the deployment must be reachable without a
# Google login. Both live in .env, which is never committed.

PATIENT_SHEET_WEBHOOK_URL = env("PATIENT_SHEET_WEBHOOK_URL", default="")
PATIENT_SHEET_WEBHOOK_TOKEN = env("PATIENT_SHEET_WEBHOOK_TOKEN", default="")


# Uploads
# Patient documents are x-rays and scans, so the ceiling is generous, but an
# unbounded upload is a denial-of-service vector.
DATA_UPLOAD_MAX_MEMORY_SIZE = env.int("MAX_UPLOAD_BYTES", default=25 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE


# Transport security
# Only applied outside DEBUG so local development over plain HTTP still works.
# These are defaults, not opinions about the deployment: each can be overridden
# from the environment for a host that terminates TLS differently.

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

if not DEBUG:
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    # Behind a reverse proxy Django cannot see the original scheme; without
    # this it would redirect an already-HTTPS request forever.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
        "SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True
    )
    SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=True)
    # Overridable for the same reason as the redirect above: an on-premise
    # clinic PC serves http://localhost with no certificate, and a browser
    # will not send a Secure cookie over plain HTTP - which locks staff out
    # of the Django admin on the very machine holding the records.
    SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=True)
    CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=True)
