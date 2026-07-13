# In PHARMACY/apps/inventory/views.py

from rest_framework import viewsets
from .models import Medicine
from .serializers import MedicineSerializer
from rest_framework.filters import OrderingFilter

class MedicineViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows medicines to be viewed or edited.
    """
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer

    filter_backends = [OrderingFilter]


    ordering_fields = ['name', 'date_added', 'price']
