"""
Compatibility serializers for the old vanilla JS frontend.

These adapt the new Django models to the legacy frontend field names.
"""

from rest_framework import serializers
from apps.patients.models import Patient
from apps.users.models import Users, Employee
from apps.appointments.models import Appointment
from apps.communications.models import Notification
from apps.quality.models import IncidentReport
from apps.inventory.models import Medicine
from apps.operations.models import Operation, Activity
from apps.finance.models import Finance
from apps.hr.models import Staff

from apps.patients.serializers import PatientSerializer
from apps.visits.serializers import VisitSerializer
from apps.lab.serializers import TestRequestSerializer
from apps.quality.serializers import IncidentReportSerializer
from apps.inventory.serializers import MedicineSerializer
from apps.operations.serializers import ActivitySerializer
from apps.hr.serializers import StaffSerializer


class CompatPatientSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.CharField(default='', read_only=True)
    phone_number = serializers.CharField(source='name.phone_number', read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'name', 'email', 'phone_number']

    def get_name(self, obj):
        try:
            return f"{obj.name.first_name} {obj.name.second_name}"
        except Exception:
            return 'Unknown'


class CompatAppointmentSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    provider_name = serializers.SerializerMethodField()
    reminder_due = serializers.SerializerMethodField()
    reminder_sent = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ['id', 'time', 'patient_name', 'type', 'provider_name', 'status', 'reminder_due', 'reminder_sent', 'notes']

    def get_time(self, obj):
        return obj.appointment_date.isoformat() if obj.appointment_date else None

    def get_patient_name(self, obj):
        try:
            return f"{obj.patient.name.first_name} {obj.patient.name.second_name}"
        except Exception:
            return 'Unknown'

    def get_provider_name(self, obj):
        if obj.doctor:
            if hasattr(obj.doctor, 'name') and obj.doctor.name:
                return f"{obj.doctor.name.first_name} {obj.doctor.name.second_name}"
            return obj.doctor.username
        return 'Unassigned'

    def get_reminder_due(self, obj):
        return None

    def get_reminder_sent(self, obj):
        return False


class CompatNotificationSerializer(serializers.ModelSerializer):
    sent_at = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    read_at = serializers.SerializerMethodField()
    subject = serializers.CharField(source='title', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'sent_at', 'patient_name', 'type', 'channel', 'subject', 'read_at', 'message']

    def get_sent_at(self, obj):
        return obj.created_at.isoformat() if obj.created_at else None

    def get_patient_name(self, obj):
        return 'System'

    def get_read_at(self, obj):
        return obj.created_at.isoformat() if obj.is_read else None


class CompatIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentReport
        fields = ['id', 'incident_type', 'description', 'incident_date', 'status']


class CompatUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.CharField(default='', read_only=True)
    role_id = serializers.CharField(source='employee_type', read_only=True)
    department = serializers.CharField(default='Operations', read_only=True)
    status = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = Users
        fields = ['id', 'name', 'email', 'role_id', 'department', 'status', 'initials']

    def get_name(self, obj):
        if hasattr(obj, 'name') and obj.name:
            return f"{obj.name.first_name} {obj.name.second_name}"
        return obj.username

    def get_status(self, obj):
        return 'active' if obj.is_active else 'inactive'

    def get_initials(self, obj):
        name = self.get_name(obj)
        return ''.join(p[0] for p in name.split(' ')).upper()[:2] or '??'


class CompatFinanceSerializer(serializers.ModelSerializer):
    staff = serializers.SerializerMethodField()
    reference = serializers.CharField(source='description', read_only=True)
    notes = serializers.CharField(source='description', read_only=True)
    approved = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    type = serializers.CharField(source='transaction_type', read_only=True)
    status = serializers.CharField(source='category', read_only=True)

    class Meta:
        model = Finance
        fields = ['id', 'staff', 'date', 'type', 'reference', 'notes', 'amount', 'approved', 'status']

    def get_staff(self, obj):
        return 'Unassigned'

    def get_approved(self, obj):
        return obj.category == 'paid' if obj.category else False

    def get_date(self, obj):
        return obj.date.isoformat() if obj.date else None


class CompatOperationSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='name', read_only=True)
    department = serializers.CharField(default='Operations', read_only=True)
    priority = serializers.CharField(default='medium', read_only=True)
    assignee = serializers.CharField(default='', read_only=True)
    due = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    notes = serializers.CharField(source='description', read_only=True)

    class Meta:
        model = Operation
        fields = ['id', 'title', 'description', 'department', 'priority', 'status', 'assignee', 'due', 'tags', 'notes']

    def get_due(self, obj):
        if obj.end_date:
            return obj.end_date.isoformat()
        return None

    def get_tags(self, obj):
        return []
