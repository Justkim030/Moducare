from rest_framework import serializers
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Employee, Users, Names

class NamesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Names
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    name = NamesSerializer()
    email = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    role_id = serializers.CharField(source='employee_type', read_only=True)
    department = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Users
        fields = ['id', 'username', 'employee_type', 'name', 'email', 'phone_number', 'role_id', 'department', 'status', 'is_active', 'is_staff']

    def get_email(self, obj):
        try:
            return obj.employee.email
        except Employee.DoesNotExist:
            return ''

   # apps/users/serializers.py

    def get_phone_number(self, obj):
        # This prevents the NoneType crash
        if obj.name and hasattr(obj.name, 'phone_number'):
            return obj.name.phone_number
        return ''
    def get_department(self, obj):
        return 'Operations'

    def get_status(self, obj):
        return 'active' if obj.is_active else 'inactive'

    def create(self, validated_data):
        name_data = validated_data.pop('name', {})
        for field in ['first_name', 'second_name', 'gender', 'age', 'phone_number']:
            if field not in name_data:
                name_data[field] = ''
        name_data.setdefault('third_name', '')
        name_instance = Names.objects.create(**name_data)
        user = Users.objects.create(name=name_instance, **validated_data)
        return user

    def update(self, instance, validated_data):
        name_data = validated_data.pop('name', None)
        if name_data and instance.name:
            for attr, value in name_data.items():
                setattr(instance.name, attr, value)
            instance.name.save()
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = ['id', 'profile_picture', 'user', 'name', 'email', 'date_added']
        parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_name(self, obj):
        try:
            return f"{obj.user.name.first_name} {obj.user.name.second_name}"
        except Exception:
            return obj.user.username

    def create(self, validated_data):
        # Extract nested structures
        user_data = validated_data.pop('user')
        name_data = user_data.pop('name', {})
        
        # Ensure all name fields exist
        for field in ['first_name', 'second_name', 'gender', 'age', 'phone_number']:
            name_data.setdefault(field, '')
        name_data.setdefault('third_name', '')
        name_instance = Names.objects.create(**name_data)
        
        # Extract password securely
        password = user_data.pop('password', None)
        
        # Create user
        user_instance = Users.objects.create(name=name_instance, **user_data)
        if password:
            user_instance.set_password(password)
            user_instance.save()
            
        # Create employee
        employee_instance = Employee.objects.create(user=user_instance, **validated_data)
        return employee_instance
