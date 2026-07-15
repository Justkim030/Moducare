from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Finance
from .serializers import FinanceSerializer

class FinanceViewSet(viewsets.ModelViewSet):
    queryset = Finance.objects.all()
    serializer_class = FinanceSerializer
    permission_classes = [IsAuthenticated]
