"""
URL configuration for ModuCare backend.

The SPA is the React app built into ``frontend/dist`` (served as static
files + a catch-all for client-side routing). The API is versioned under
``/api/v1/``; a small set of unversioned auth/health endpoints
(``/api/login/``, ``/api/register/``, ``/api/capabilities/``,
``/api/role-permissions/``, ``/api/health/``) remain for the SPA login flow.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.generic import TemplateView
from django.conf.urls.static import static
from django.views.static import serve
from rest_framework.authtoken.views import obtain_auth_token
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.users.views import LoginView, RegisterView
from apps.core.views import capabilities_view, role_permissions_view, health_view

# React SPA build output (run `npm run build` in ../frontend)
SPA_DIR = settings.BASE_DIR / '..' / 'frontend' / 'dist'

urlpatterns = [
    path('admin/', admin.site.urls),

    # Versioned API consumed by the React SPA
    path('api/v1/inventory/', include('apps.inventory.urls')),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/patients/', include('apps.patients.urls')),
    path('api/v1/prescriptions/', include('apps.prescriptions.urls')),
    path('api/v1/visits/', include('apps.visits.urls')),
    path('api/v1/lab/', include('apps.lab.urls')),
    path('api/v1/accounts/', include('apps.accounts.urls')),
    path('api/v1/incident/', include('apps.quality.urls')),
    path('api/v1/appointments/', include('apps.appointments.urls')),
    path('api/v1/finance/', include('apps.finance.urls')),
    path('api/v1/hr/', include('apps.hr.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
    path('api/v1/reports/', include('apps.reports.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
    path('api/v1/notifications/', include('apps.communications.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/referrals/', include('apps.referrals.urls')),
    path('api/v1/operations/', include('apps.operations.urls')),
    path('api-auth/', include('rest_framework.urls')),
    path('api/v1/get-token/', obtain_auth_token),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # Unversioned auth/health endpoints used by the SPA login flow
    path('api/login/', LoginView.as_view(), name='login'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/capabilities/', capabilities_view, name='capabilities'),
    path('api/role-permissions/', role_permissions_view, name='role-permissions'),
    path('api/health/', health_view, name='health'),
]

# Serve the built React SPA: static assets, then a catch-all for
# client-side routing (everything not under /api/, /admin/, /static/, /media/).
urlpatterns += [
    re_path(
        r'^(?!api/|admin/|__debug__/|static/|media/).*$',
        TemplateView.as_view(template_name='index.html'),
        name='spa',
    ),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
