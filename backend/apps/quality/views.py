from .serializers import IncidentReportSerializer
from .models import IncidentReport
from rest_framework import viewsets
from rest_framework.response import Response

class IncidentReportViewSet(viewsets.ModelViewSet):
    queryset = IncidentReport.objects.all().select_related('employee__user', 'patient__name')
    serializer_class = IncidentReportSerializer

    def get_queryset(self):
        return super().get_queryset().select_related('employee__user', 'patient__name')