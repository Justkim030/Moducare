from rest_framework import serializers
from .models import IncidentReport

class IncidentReportSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source='incident_type', read_only=True)
    created = serializers.CharField(source='incident_date', read_only=True)
    status = serializers.SerializerMethodField()
    severity = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    reporter_role = serializers.SerializerMethodField()
    action_taken = serializers.CharField(source='description', read_only=True)
    witness_name = serializers.CharField(default='', read_only=True)

    class Meta:
        model = IncidentReport
        fields = [
            "id",
            "created",
            "title",
            "description",
            "status",
            "severity",
            "employee",
            "category",
            "patient",
            "time",
            "reporter_role",
            "action_taken",
            "witness_name",
            "incident_date",
            "incident_type",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_status(self, obj):
        return 'open'

    def get_severity(self, obj):
        return 'medium'

    def get_category(self, obj):
        return 'internal'

    def get_reporter_role(self, obj):
        try:
            return obj.employee.user.employee_type
        except Exception:
            return ''
