from rest_framework import serializers
from .models import Prescription, PrescriptionItem
from apps.inventory.models import Medicine
from apps.visits.models import Visits

class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    medicine_price = serializers.DecimalField(source='medicine.price', max_digits=10, decimal_places=2, read_only=True)
    medicine_stock = serializers.IntegerField(source='medicine.quantity', read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = [
            'id', 'prescription', 'medicine', 'medicine_name', 
            'medicine_price', 'medicine_stock', 'quantity', 'notes'
        ]

class PrescriptionSerializer(serializers.ModelSerializer):
    # Map 'prescribed_by' (API) -> 'employee' (DB)
    prescribed_by = serializers.PrimaryKeyRelatedField(source='employee', read_only=True)
    doctor_name = serializers.SerializerMethodField()
    
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    items = PrescriptionItemSerializer(many=True, required=False)
    
    visit = serializers.PrimaryKeyRelatedField(
        queryset=Visits.objects.all(), 
        write_only=True,
        required=True
    )

    class Meta:
        model = Prescription
        fields = [
            'id', 'patient', 'patient_name', 
            'prescribed_by', 'doctor_name', 
            'date_prescribed', 'status', 'items',
            'visit'
        ]
        # FIX 1: Add 'status' here so the API doesn't demand it from the user
        read_only_fields = ['patient', 'prescribed_by', 'doctor_name', 'status']

    def get_doctor_name(self, obj):
        try:
            if obj.employee and obj.employee.user and obj.employee.user.name:
                return f"{obj.employee.user.name.first_name} {obj.employee.user.name.second_name}"
            return str(obj.employee)
        except Exception:
            return "Unknown Doctor"

    def create(self, validated_data):
        items_data = validated_data.pop('items', []) 
        visit = validated_data.pop('visit')
        
        validated_data['patient'] = visit.patient
        validated_data['visit'] = visit
        
        # FIX 2: Set default status automatically
        validated_data['status'] = 'PENDING'

        # Get Employee
        user = self.context['request'].user
        employee_instance = None
        if user.is_authenticated:
            try:
                employee_instance = user.employee
            except AttributeError:
                try:
                    employee_instance = user.profile
                except AttributeError:
                    pass

        validated_data['employee'] = employee_instance
        
        prescription = Prescription.objects.create(**validated_data)
        
        for item_data in items_data:
            # Note: We pass 'patient' because your Item model requires it
            PrescriptionItem.objects.create(
                prescription=prescription, 
                patient=visit.patient, 
                **item_data
            )
            
        if visit.status != 'COMPLETED':
            visit.status = 'COMPLETED'
            visit.save()
            
        return prescription