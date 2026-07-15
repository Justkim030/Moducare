"""
URL configuration for pharmacy project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
"""

from django.contrib import admin
from django.urls import path, include, re_path
from backend import settings
from rest_framework.authtoken.views import obtain_auth_token
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings as django_settings
from django.conf import settings as django_settings
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Collaborator's React frontend API (v1)
urlpatterns = [
    path('admin/', admin.site.urls),

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
    
    # Old vanilla JS frontend pages
    path('login.html', TemplateView.as_view(template_name='login.html'), name='login-page'),
    path('register.html', TemplateView.as_view(template_name='register.html'), name='register-page'),
    path('forgot-password.html', TemplateView.as_view(template_name='forgot-password.html'), name='forgot-password-page'),
    re_path(r'^$', TemplateView.as_view(template_name='index.html'), name='index'),
    
    # Old vanilla JS frontend static files
    path('js/<path:path>', serve, {'document_root': django_settings.BASE_DIR / '..' / 'js'}),
    path('css/<path:path>', serve, {'document_root': django_settings.BASE_DIR / '..' / 'css'}),
    path('src/<path:path>', serve, {'document_root': django_settings.BASE_DIR / '..' / 'src'}),
]

# Old vanilla JS frontend compatibility layer (api/ prefix)
from apps.users.views import UserViewSet, EmployeeViewSet, LoginView, RegisterView, CurrentEmployeeProfileView
from apps.patients.views import PatientViewSet
from apps.quality.views import IncidentReportViewSet
from apps.inventory.views import MedicineViewSet
from apps.core.views import capabilities_view, role_permissions_view, health_view
from apps.analytics.views import AnalyticsOverviewView
from apps.reports.views import ReportScheduledListView, ReportRunView
from apps.inventory.views import InventoryAlertsView

user_list = UserViewSet.as_view({'get': 'list', 'post': 'create'})
user_detail = UserViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})

employee_list = EmployeeViewSet.as_view({'get': 'list', 'post': 'create'})
employee_detail = EmployeeViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})

patient_list = PatientViewSet.as_view({'get': 'list', 'post': 'create'})
patient_detail = PatientViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})

incident_list = IncidentReportViewSet.as_view({'get': 'list', 'post': 'create'})
incident_detail = IncidentReportViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})

inventory_list = MedicineViewSet.as_view({'get': 'list', 'post': 'create'})
inventory_detail = MedicineViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})

compat_patterns = [
    path('api/login/', LoginView.as_view(), name='login'),
    path('api/register/', RegisterView.as_view(), name='register'),
    path('api/capabilities/', capabilities_view, name='capabilities'),
    path('api/role-permissions/', role_permissions_view, name='role-permissions'),
    path('api/health/', health_view, name='health'),
    path('api/employees/me/', CurrentEmployeeProfileView.as_view(), name='employee-me'),
    path('api/inventory/alerts/', InventoryAlertsView.as_view(), name='inventory-alerts'),
    path('api/analytics/overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('api/reports/scheduled/', ReportScheduledListView.as_view(), name='reports-scheduled'),
    path('api/reports/<pk>/run/', ReportRunView.as_view(), name='report-run'),

    path('api/users/', user_list),
    path('api/users/<pk>/', user_detail),
    path('api/employees/', employee_list),
    path('api/employees/<pk>/', employee_detail),
    path('api/patients/', patient_list),
    path('api/patients/<pk>/', patient_detail),
    path('api/incidents/', incident_list),
    path('api/incidents/<pk>/', incident_detail),
    path('api/inventory/', inventory_list),
    path('api/inventory/<pk>/', inventory_detail),

    path('api/operations/', include('apps.operations.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/appointments/', include('apps.appointments.urls')),
    path('api/staff/', include('apps.hr.urls')),
    path('api/profiles/', include('apps.hr.urls')),
    path('api/contracts/', include('apps.hr.urls')),
    path('api/trainings/', include('apps.hr.urls')),
    path('api/performance/', include('apps.hr.urls')),
    path('api/payroll/', include('apps.hr.urls')),
    path('api/attendance/', include('apps.hr.urls')),
    path('api/leave/', include('apps.hr.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/notifications/', include('apps.communications.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/referrals/', include('apps.referrals.urls')),
]

urlpatterns += compat_patterns

# SPA catch-all for old frontend (must be last)
urlpatterns += [
    re_path(r'^(?P<path>.*)/?$', TemplateView.as_view(template_name='../index.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
