"""Serving the built React app from Django.

In development the frontend runs under Vite on its own port and talks to
Django across CORS. A clinic PC should not need two processes, a Node install
and two ports, so the bundled build is different: `npm run build` produces
static files, Django serves them, and everything answers on one port.

React Router owns the paths below. A patient opening /appointment directly, or
reloading on /clinic/patients, must still be handed index.html - the router
reads the URL once the page is running. Returning 404 for those is the classic
single-page-app deployment bug, and it only shows up on a refresh, which is
exactly what a receptionist does when something looks stale.

/api/, /admin/ and /media/ are matched before this view, so they are never
swallowed by the catch-all.
"""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.views.generic import View


class FrontendView(View):
    """Hand back the built index.html for any non-API path."""

    def get(self, request, *args, **kwargs):
        index = Path(settings.FRONTEND_BUILD_DIR) / "index.html"
        if not index.exists():
            # A clear instruction beats a stack trace: this means the bundle
            # step was skipped, which is a build mistake, not a code one.
            return HttpResponse(
                "<h1>Frontend not built</h1>"
                "<p>The React app has not been bundled yet. Run:</p>"
                "<pre>cd frontend\nnpm install\nnpm run build</pre>"
                "<p>then restart the server. In development, run the Vite dev "
                "server instead and use its own port.</p>",
                status=501,
                content_type="text/html",
            )
        # FileResponse streams and sets Content-Type from the suffix.
        return FileResponse(index.open("rb"), content_type="text/html")
