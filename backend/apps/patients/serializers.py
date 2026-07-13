from rest_framework import serializers
from .models import Patient
from apps.users.models import Names
# Ensure you have the NamesSerializer available. 
# You can import it from users if it's public, or redefine it here.

class NamesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Names
        fields = '__all__'

class PatientSerializer(serializers.ModelSerializer):
    # 1. Enable nested writing
    name = NamesSerializer()

    class Meta:
        model = Patient
        fields = ['id', 'name', 'register_date']

    def create(self, validated_data):
        """
        Custom create method to handle nested Name creation for Patients
        """
        # 1. Extract name data
        name_data = validated_data.pop('name')

        # 2. Create Name record
        name_instance = Names.objects.create(**name_data)

        # 3. Create Patient record linked to Name
        patient_instance = Patient.objects.create(name=name_instance, **validated_data)

        return patient_instance