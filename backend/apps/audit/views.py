from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Audit
from .serializers import AuditSerializer

class AuditViewSet(viewsets.ModelViewSet):
    queryset = Audit.objects.all()
    serializer_class = AuditSerializer
    permission_classes = [IsAuthenticated]
