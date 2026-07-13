from rest_framework import serializers
from .models import Employee, Users, Names

class NamesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Names
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    # Allow writing the nested Name object
    name = NamesSerializer()

    class Meta:
        model = Users
        fields = ['username', 'password', 'employee_type', 'name']
        # Password should be write-only for security
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        # This handles creating a User directly if needed (e.g. for Patients)
        name_data = validated_data.pop('name')
        name_instance = Names.objects.create(**name_data)
        
        password = validated_data.pop('password')
        user = Users.objects.create(name=name_instance, **validated_data)
        user.set_password(password)
        user.save()
        return user

class EmployeeSerializer(serializers.ModelSerializer):
    # Allow writing the nested User object
    user = UserSerializer()

    class Meta:
        model = Employee
        fields = ['id', 'profile_picture', 'user', 'email', 'date_added']

    def create(self, validated_data):
        """
        Custom create method to handle the nested creation of:
        1. Name -> 2. User -> 3. Employee
        """
        # 1. Extract the nested User data
        user_data = validated_data.pop('user')
        
        # 2. Extract the nested Name data from within User data
        name_data = user_data.pop('name')

        # 3. Create the Name record first
        name_instance = Names.objects.create(**name_data)

        # 4. Create the User record, linking the Name
        password = user_data.pop('password')
        user_instance = Users.objects.create(name=name_instance, **user_data)
        user_instance.set_password(password) # Hash the password
        user_instance.save()

        # 5. Finally, create the Employee record linking the User
        employee_instance = Employee.objects.create(user=user_instance, **validated_data)
        
        return employee_instance