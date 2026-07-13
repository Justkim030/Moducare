# In PHARMACY/apps/prescriptions/permissions.py
from rest_framework.permissions import BasePermission

class IsDoctor(BasePermission):
    """ Allows access only to Doctor users. """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'DOCTOR')

class IsChemist(BasePermission):
    """ Allows access only to Chemist users. """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'CHEMIST')