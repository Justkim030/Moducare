from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Staff, EmployeeProfile, Contract, TrainingRecord, PerformanceReview, PayrollRecord, TimeAttendance, LeaveRequest
from .serializers import (
    StaffSerializer,
    EmployeeProfileSerializer,
    ContractSerializer,
    TrainingRecordSerializer,
    PerformanceReviewSerializer,
    PayrollRecordSerializer,
    TimeAttendanceSerializer,
    LeaveRequestSerializer,
)

class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all().select_related('user', 'department')
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('user', 'department')


class EmployeeProfileViewSet(viewsets.ModelViewSet):
    queryset = EmployeeProfile.objects.all().select_related('employee__user')
    serializer_class = EmployeeProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')


class ContractViewSet(viewsets.ModelViewSet):
    queryset = Contract.objects.all().select_related('employee__user')
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')


class TrainingRecordViewSet(viewsets.ModelViewSet):
    queryset = TrainingRecord.objects.all().select_related('employee__user')
    serializer_class = TrainingRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')


class PerformanceReviewViewSet(viewsets.ModelViewSet):
    queryset = PerformanceReview.objects.all().select_related('employee__user')
    serializer_class = PerformanceReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')


class PayrollRecordViewSet(viewsets.ModelViewSet):
    queryset = PayrollRecord.objects.all().select_related('employee__user')
    serializer_class = PayrollRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')


class TimeAttendanceViewSet(viewsets.ModelViewSet):
    queryset = TimeAttendance.objects.all().select_related('employee__user')
    serializer_class = TimeAttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')


class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all().select_related('employee__user')
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user')
