# apps/visits/serializers.py
from rest_framework import serializers
from .models import Visits, Triage, WardLog

class TriageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Triage
        fields = [
            'chief_complaint', 'triage_level', 'body_temp', 
            'weight', 'bp_systolic', 'bp_diastolic', 'heart_rate'
        ]

class WardLogSerializer(serializers.ModelSerializer):
    nurse_name = serializers.CharField(source='nurse.user.username', read_only=True)
    # Nested Serializer for Vitals
    triage = TriageSerializer()

    class Meta:
        model = WardLog
        fields = ['id', 'visit', 'nurse', 'nurse_name', 'timestamp', 'notes', 'triage']
        read_only_fields = ['nurse', 'timestamp']

    def create(self, validated_data):
        # 1. Pop the nested triage data
        triage_data = validated_data.pop('triage')
        
        # 2. Create the Triage record (Vitals)
        triage_instance = Triage.objects.create(**triage_data)
        
        # 3. Auto-assign the nurse
        user = self.context['request'].user
        nurse = None
        if hasattr(user, 'employee'):
            nurse = user.employee

        # 4. Create the WardLog linking everything
        ward_log = WardLog.objects.create(
            triage=triage_instance, 
            nurse=nurse, 
            **validated_data
        )
        return ward_log

class VisitSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    triage = TriageSerializer()

    class Meta:
        model = Visits
        fields = [
            'id', 'patient', 'patient_name', 'visit_date', 
            'status', 'patient_type', 'ward', 'bed_number',
            'registered_by', 'consultation_notes', 'triage'
        ]
        read_only_fields = ['registered_by']

    def get_patient_name(self, obj):
        try:
            return f"{obj.patient.name.first_name} {obj.patient.name.second_name}"
        except AttributeError:
            return "Unknown"

    def create(self, validated_data):
        triage_data = validated_data.pop('triage')
        triage_instance = Triage.objects.create(**triage_data)
        
        user = self.context['request'].user
        employee = None
        if hasattr(user, 'employee'):
            employee = user.employee

        validated_data['registered_by'] = employee
        visit_instance = Visits.objects.create(triage=triage_instance, **validated_data)
        
        return visit_instance