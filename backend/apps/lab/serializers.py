# apps/lab/serializers.py
from rest_framework import serializers
from .models import LabTest, TestRequest

class LabTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTest
        fields = '__all__'

class TestRequestSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='test.name', read_only=True)
    patient_name = serializers.CharField(source='patient.name.first_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user.username', read_only=True)
    
    class Meta:
        model = TestRequest
        fields = [
            'id', 'visit', 'test', 'test_name', 'patient', 'patient_name',
            'doctor', 'doctor_name', 'lab_tech', 'status', 
            'result_notes', 'requested_at', 'completed_at'
        ]
        read_only_fields = ['doctor', 'lab_tech', 'requested_at', 'completed_at']

    def create(self, validated_data):
        # Automatically assign the logged-in Doctor
        user = self.context['request'].user
        if hasattr(user, 'employee'):
            validated_data['doctor'] = user.employee
        return super().create(validated_data)