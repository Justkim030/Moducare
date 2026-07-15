from rest_framework import serializers
from .models import Patient
from apps.users.models import Names

class NamesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Names
        fields = '__all__'

class PatientSerializer(serializers.ModelSerializer):
    name = NamesSerializer()
    full_name = serializers.SerializerMethodField()
    email = serializers.CharField(default='', read_only=True)
    phone_number = serializers.CharField(source='name.phone_number', read_only=True)
    dob = serializers.SerializerMethodField()
    gender = serializers.CharField(source='name.gender', read_only=True)
    address = serializers.CharField(default='', read_only=True)
    county = serializers.CharField(default='', read_only=True)
    next_of_kin = serializers.CharField(default='', read_only=True)
    next_of_kin_phone = serializers.CharField(default='', read_only=True)
    ampkh_id = serializers.CharField(default='', read_only=True)
    national_id = serializers.CharField(default='', read_only=True)
    insurance_id = serializers.CharField(default='', read_only=True)
    hiv_status = serializers.CharField(default='unknown', read_only=True)
    registration_date = serializers.CharField(source='register_date', read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'name', 'full_name', 'email', 'phone_number', 'dob', 'gender', 'address', 'county', 'next_of_kin', 'next_of_kin_phone', 'ampkh_id', 'national_id', 'insurance_id', 'hiv_status', 'registration_date', 'register_date']

    def get_full_name(self, obj):
        try:
            return f"{obj.name.first_name} {obj.name.second_name}"
        except Exception:
            return 'Unknown'

    def get_dob(self, obj):
        try:
            age = obj.name.age
            if age:
                from datetime import datetime
                current_year = datetime.now().year
                return str(current_year - age)
        except Exception:
            pass
        return ''

    def create(self, validated_data):
        name_data = validated_data.pop('name')
        name_instance = Names.objects.create(**name_data)
        patient_instance = Patient.objects.create(name=name_instance, **validated_data)
        return patient_instance
