from .serializers import IncidentReportSerializer
from .models import IncidentReport
from rest_framework import viewsets
from rest_framework.response import Response

class IncidentReportViewSet(viewsets.ModelViewSet):
    queryset = IncidentReport.objects.all()
    serializer_class = IncidentReportSerializer