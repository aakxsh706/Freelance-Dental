from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from clinic.views.spa import FrontendView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("clinic.urls")),
]

# Patient documents (x-rays, reports) are uploaded to MEDIA_ROOT. Django's
# static helper serves them in development only; in production these are
# patient records and must be served by the web server behind an access check,
# never handed out from an open directory.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# The single-page app, last so it never shadows api/, admin/ or media/.
# Every remaining path is a React Router route and gets index.html.
urlpatterns += [
    re_path(r"^(?!api/|admin/|media/|static/).*$", FrontendView.as_view(), name="frontend"),
]
