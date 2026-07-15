from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Visits, WardLog
from .serializers import VisitSerializer, WardLogSerializer
from apps.users.permissions import IsTriageStaff, IsDoctor
from rest_framework.filters import OrderingFilter


class VisitViewSet(viewsets.ModelViewSet):
    queryset = Visits.objects.all().order_by('triage__triage_level', 'visit_date')
    serializer_class = VisitSerializer
    
    filter_backends = [OrderingFilter]
    ordering_fields = ['visit_date', 'patient__first_name', 'status']

    def get_queryset(self):
        return super().get_queryset().select_related('patient__name', 'registered_by__user', 'triage')

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsAdminUser | IsTriageStaff]
        elif self.action in ['list', 'retrieve', 'save_report']: 
            self.permission_classes = [IsAdminUser | IsTriageStaff | IsDoctor]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdminUser | IsTriageStaff]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()
    
    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    @action(detail=True, methods=['post'], permission_classes=[IsDoctor])
    def save_report(self, request, pk=None):
        visit = self.get_object()
        
        notes = request.data.get('consultation_notes')
        pharmacy_notes = request.data.get('pharmacy_notes')

        if notes is not None:
            visit.consultation_notes = notes
        if pharmacy_notes is not None:
            visit.pharmacy_notes = pharmacy_notes

        complaint = request.data.get('chief_complaint')
        if complaint is not None and visit.triage:
            visit.triage.chief_complaint = complaint
            visit.triage.save()
        
        if visit.status == 'CONSULTATION':
            visit.status = Visits.VisitStatus.COMPLETED
        elif visit.status == Visits.VisitStatus.PENDING:
            visit.status = Visits.VisitStatus.COMPLETED
        visit.save()
        
        serializer = self.get_serializer(visit)
        return Response(serializer.data, status=status.HTTP_200_OK)

class WardLogViewSet(viewsets.ModelViewSet):
    queryset = WardLog.objects.all().order_by('-timestamp')
    serializer_class = WardLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset().select_related('visit__patient__name', 'nurse__user', 'triage')
        visit_id = self.request.query_params.get('visit_id')
        if visit_id:
            queryset = queryset.filter(visit_id=visit_id)
        return queryset