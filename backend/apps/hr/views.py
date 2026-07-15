from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Employee, EmployeeProfile, Contract, TrainingRecord, PerformanceReview, PayrollRecord, TimeAttendance, LeaveRequest
from .serializers import (
    EmployeeSerializer,
    EmployeeProfileSerializer,
    ContractSerializer,
    TrainingRecordSerializer,
    PerformanceReviewSerializer,
    PayrollRecordSerializer,
    TimeAttendanceSerializer,
    LeaveRequestSerializer,
)

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]


class EmployeeProfileViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.all()
    serializer_class = EmployeeProfileSerializer
    permission_classes = [IsAuthenticated]


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]


class TrainingRecordViewSet(viewsets.ModelViewSet):
    queryset = TrainingRecord.objects.all()
    serializer_class = TrainingRecordSerializer
    permission_classes = [IsAuthenticated]


class PerformanceReviewViewSet(viewsets.ModelViewSet):
    queryset = PerformanceReview.objects.all()
    serializer_class = PerformanceReviewSerializer
    permission_classes = [IsAuthenticated]


class PayrollRecordViewSet(viewsets.ModelViewSet):
    queryset = PayrollRecord.objects.all()
    serializer_class = PayrollRecordSerializer
    permission_classes = [IsAuthenticated]


class TimeAttendanceViewSet(viewsets.ModelViewSet):
    queryset = TimeAttendance.objects.all()
    serializer_class = TimeAttendanceSerializer
    permission_classes = [IsAuthenticated]


class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]
