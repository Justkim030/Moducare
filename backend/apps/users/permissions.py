# apps/users/permissions.py
from rest_framework.permissions import BasePermission

class IsDoctor(BasePermission):
    """ Allows access only to Doctor users. """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'DOCTOR')

class IsChemist(BasePermission):
    """ Allows access only to Chemist users. """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'CHEMIST')

class IsTriageStaff(BasePermission):
    """ Allows access only to Triage users (and Nurses). """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type in ['TRIAGE', 'NURSE'])

# --- NEW ROLES ---

class IsReceptionist(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'RECEPTIONIST')

class IsLabTech(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'LAB_TECH')

class IsAccountant(BasePermission):  # <--- CRITICAL: Must inherit from BasePermission
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.employee_type == 'ACCOUNTANT')