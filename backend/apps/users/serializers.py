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
        fields = ['id', 'username', 'password', 'employee_type', 'name', 'email', 'phone_number', 'role_id', 'department', 'status', 'is_active', 'is_staff']
        extra_kwargs = {'password': {'write_only': True}}

    def get_email(self, obj):
        try:
            return obj.employee.email
        except Employee.DoesNotExist:
            return ''

    def get_phone_number(self, obj):
        try:
            return obj.name.phone_number
        except Names.DoesNotExist:
            return ''

    def get_department(self, obj):
        return 'Operations'

    def get_status(self, obj):
        return 'active' if obj.is_active else 'inactive'

    def create(self, validated_data):
        name_data = validated_data.pop('name')
        name_instance = Names.objects.create(**name_data)
        password = validated_data.pop('password')
        user = Users.objects.create(name=name_instance, **validated_data)
        user.set_password(password)
        user.save()
        return user

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
        user_data = validated_data.pop('user')
        name_data = user_data.pop('name')
        name_instance = Names.objects.create(**name_data)
        password = user_data.pop('password')
        user_instance = Users.objects.create(name=name_instance, **user_data)
        user_instance.set_password(password)
        user_instance.save()
        employee_instance = Employee.objects.create(user=user_instance, **validated_data)
        return employee_instance
