# apps/lab/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import LabTest, TestRequest
from .serializers import LabTestSerializer, TestRequestSerializer

from apps.users.permissions import IsDoctor, IsLabTech 


from rest_framework.permissions import IsAuthenticated, IsAdminUser 

class LabTestViewSet(viewsets.ModelViewSet):
    queryset = LabTest.objects.all()
    serializer_class = LabTestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related(None)

class TestRequestViewSet(viewsets.ModelViewSet):
    queryset = TestRequest.objects.all().order_by('-requested_at')
    serializer_class = TestRequestSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [IsDoctor]
        if self.action in ['update', 'partial_update', 'complete_test']:
            return [IsLabTech | IsAdminUser]
        return [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().select_related('visit__patient__name', 'test', 'patient__name', 'doctor__user', 'lab_tech__user')
        user = self.request.user
        if user.employee_type == 'LAB_TECH':
            return queryset.filter(status__in=['REQUESTED', 'IN_PROGRESS'])
        if user.employee_type == 'DOCTOR':
            return queryset.filter(doctor__user=user)
        return queryset

    @action(detail=True, methods=['post'])
    def complete_test(self, request, pk=None):
        test_req = self.get_object()
        result = request.data.get('result_notes')
        
        if not result:
            return Response({'error': 'Result notes are required'}, status=400)

        test_req.result_notes = result
        test_req.status = 'COMPLETED'
        test_req.lab_tech = request.user.employee
        test_req.completed_at = timezone.now()
        test_req.save()

        return Response(self.get_serializer(test_req).data)