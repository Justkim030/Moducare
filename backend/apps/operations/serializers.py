from rest_framework import serializers
from .models import Operation, Activity, CalendarEvent

class OperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Operation
        fields = '__all__'


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = '__all__'


class CalendarEventSerializer(serializers.ModelSerializer):
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True, required=False)
    employee_id = serializers.PrimaryKeyRelatedField(source='employee', read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = CalendarEvent
        fields = ['id', 'title', 'description', 'event_type', 'status', 'start_time', 'end_time', 'color', 'employee_id', 'employee_name', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        if obj.employee and hasattr(obj.employee, 'name') and obj.employee.name:
            return f"{obj.employee.name.first_name} {obj.employee.name.second_name}"
        return ''

