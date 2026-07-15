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
from apps.operations.models import Activity


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
