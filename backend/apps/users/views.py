from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response 
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Employee, Users
from .serializers import EmployeeSerializer, UserSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = Users.objects.all().select_related('name')
    serializer_class = UserSerializer


class CurrentEmployeeProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            employee = Employee.objects.select_related('user__name').get(user=request.user)
            serializer = EmployeeSerializer(employee)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee profile not found."}, status=404)


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all().select_related('user__name')
    serializer_class = EmployeeSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email') or request.data.get('username')
        password = request.data.get('password')
        if not email or not password:
            return Response({'ok': False, 'error': 'Email/username and password required'}, status=400)

        from django.contrib.auth import authenticate
        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({'ok': False, 'error': 'Invalid credentials'}, status=401)

        refresh = RefreshToken.for_user(user)
        
        from apps.core.views import getCapabilities, getModulesForRole
        role_id = user.employee_type if hasattr(user, 'employee_type') else None
        
        display_name = ''
        if hasattr(user, 'name') and user.name:
            display_name = f"{user.name.first_name} {user.name.second_name}".strip()
        else:
            display_name = user.username
        
        return Response({
            'ok': True,
            'token': str(refresh.access_token),
            'user': {
                'id': user.id,
                'username': user.username,
                'name': display_name,
                'role_id': role_id,
                'employee_type': user.employee_type,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'capabilities': getCapabilities(role_id),
                'modules': getModulesForRole(role_id),
            }
        })


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        employee_type = request.data.get('employee_type', 'DOCTOR')
        first_name = request.data.get('first_name', '')
        second_name = request.data.get('second_name', '')
        gender = request.data.get('gender', '')
        age = request.data.get('age', 0)
        phone_number = request.data.get('phone_number', '')

        if not username or not password:
            return Response({'ok': False, 'error': 'Username and password required'}, status=400)

        if Users.objects.filter(username=username).exists():
            return Response({'ok': False, 'error': 'Username already exists'}, status=400)

        from apps.users.models import Names, Employee
        name = Names.objects.create(
            first_name=first_name,
            second_name=second_name,
            gender=gender,
            age=age,
            phone_number=phone_number,
        )
        user = Users.objects.create_user(
            username=username,
            password=password,
            name=name,
            employee_type=employee_type,
        )
        Employee.objects.create(user=user, email=f'{username}@hospital.local')

        refresh = RefreshToken.for_user(user)
        return Response({
            'ok': True,
            'token': str(refresh.access_token),
            'user': {
                'id': user.id,
                'username': user.username,
                'employee_type': user.employee_type,
            }
        }, status=201)
