from django.urls import path
from .views import capabilities_view, role_permissions_view, health_view

urlpatterns = [
    path('capabilities/', capabilities_view, name='capabilities'),
    path('role-permissions/', role_permissions_view, name='role-permissions'),
    path('health/', health_view, name='health'),
]
