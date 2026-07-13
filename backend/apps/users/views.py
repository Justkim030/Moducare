from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response 
from rest_framework.permissions import IsAuthenticated

from .models import Employee, Users
from .serializers import EmployeeSerializer, UserSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = Users.objects.all()
    serializer_class = UserSerializer


class CurrentEmployeeProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Look up the employee instance linked to the logged-in user
            employee = Employee.objects.get(user=request.user)
            serializer = EmployeeSerializer(employee)
            return Response(serializer.data)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee profile not found."}, status=404)
        
        
class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer