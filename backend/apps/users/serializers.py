from rest_framework import serializers
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
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
        
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # To handle file uploads

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
    
    
    def update(self, instance, validated_data):
        """
        Custom update method to handle flat FormData containing profile_picture
        and deeply nested Name fields (first_name, second_name, age, gender).
        """
        # 1. Update the top-level Employee fields (like profile_picture and email)
        instance.profile_picture = validated_data.get('profile_picture', instance.profile_picture)
        instance.email = validated_data.get('email', instance.email)
        instance.save()

        # 2. Extract flat fields from the raw request payload.
        # We MUST use self.initial_data here because standard DRF validation 
        # strips out any fields that aren't listed in the Meta class.
        request_data = getattr(self, 'initial_data', {})
        
        # 3. Dig down into the nested 'Names' model and apply changes
        if instance.user and instance.user.name:
            name_instance = instance.user.name
            has_name_changes = False

            if 'first_name' in request_data:
                name_instance.first_name = request_data['first_name']
                has_name_changes = True
                
            if 'second_name' in request_data:
                name_instance.second_name = request_data['second_name']
                has_name_changes = True
                
            if 'age' in request_data:
                name_instance.age = request_data['age']
                has_name_changes = True
                
            if 'gender' in request_data:
                name_instance.gender = request_data['gender']
                has_name_changes = True

            # Only ping the database if text fields actually changed
            if has_name_changes:
                name_instance.save()

        return instance
    