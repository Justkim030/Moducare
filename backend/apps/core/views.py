from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import viewsets
from .models import Department, Role
from .serializers import DepartmentSerializer, RoleSerializer

ROLE_CAPABILITIES = {
    'ADMIN': ['*'],
    'DOCTOR': ['dashboard:view', 'patient:read', 'patient:write_clinical', 'encounter:read', 'encounter:write', 'prescription:write', 'lab:order', 'lab:read', 'referral:write', 'appointment:read', 'communication:read', 'communication:write'],
    'CHEMIST': ['dashboard:view', 'patient:read', 'pharmacy:dispense', 'pharmacy:inventory_read', 'lab:read', 'communication:read'],
    'STORE_MANAGER': ['dashboard:view', 'inventory:read', 'inventory:write', 'inventory:approve', 'communication:read'],
    'QUALITY_ASSURANCE': ['dashboard:view', 'incident:read', 'audit:read', 'analytics:read', 'report:export', 'communication:read'],
    'TRIAGE': ['dashboard:view', 'patient:read', 'patient:write_vitals', 'encounter:read', 'appointment:read', 'communication:read'],
    'NURSE': ['dashboard:view', 'patient:read', 'patient:write_vitals', 'encounter:read', 'appointment:read', 'communication:read'],
    'RECEPTIONIST': ['dashboard:view', 'patient:read', 'patient:register', 'appointment:read', 'appointment:write', 'communication:read'],
    'ACCOUNTANT': ['dashboard:view', 'patient:read', 'finance:read', 'finance:write', 'report:export', 'communication:read'],
    'LAB_TECH': ['dashboard:view', 'lab:read', 'lab:result_entry', 'communication:read'],
}

MODULE_CAPABILITIES = {
    'dashboard': 'dashboard:view',
    'patients': 'patient:read',
    'staff': 'staff:read',
    'finance-billing': 'finance:read',
    'operations': 'operations:read',
    'clinical': 'clinical:read',
    'communications': 'communication:read',
    'audit-compliance': 'audit:read',
    'incident-reporting': 'incident:read',
    'scheduling-calendar': 'appointment:read',
    'documents': 'patient:read',
    'encounters': 'encounter:read',
    'lab-orders': 'lab:read',
    'pharmacy': 'pharmacy:inventory_read',
    'inventory': 'inventory:read',
    'analytics-reports': 'analytics:read',
    'admin': 'user:manage',
    'system-health': 'system:health',
}


def getCapabilities(role_id):
    if not role_id:
        return []
    caps = ROLE_CAPABILITIES.get(role_id, [])
    if '*' in caps:
        return list(set([c for caps_list in ROLE_CAPABILITIES.values() for c in caps_list if c != '*']))
    return caps


def getModulesForRole(role_id):
    modules = []
    for mod, cap in MODULE_CAPABILITIES.items():
        if cap in getCapabilities(role_id):
            modules.append(mod)
    return modules


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def capabilities_view(request):
    role_id = getattr(request.user, 'employee_type', None)
    caps = getCapabilities(role_id)
    modules = getModulesForRole(role_id)
    return Response({'ok': True, 'capabilities': caps, 'modules': modules})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def role_permissions_view(request):
    role_id = request.query_params.get('role_id')
    if not role_id:
        return Response({'ok': False, 'error': 'role_id is required'}, status=400)
    caps = getCapabilities(role_id)
    return Response({'ok': True, 'role_id': role_id, 'capabilities': caps})


@api_view(['GET'])
@permission_classes([AllowAny])
def health_view(request):
    return Response({'ok': True})


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related(None)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().select_related('department')
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('department')
