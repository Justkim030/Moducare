from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Medicine
from .serializers import MedicineSerializer
from rest_framework.filters import OrderingFilter

class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['name', 'date_added', 'price']

    def get_queryset(self):
        return super().get_queryset().select_related(None)

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        low_stock = self.get_queryset().filter(quantity__lte=10)
        serializer = self.get_serializer(low_stock, many=True)
        return Response({'ok': True, 'data': serializer.data})


class InventoryAlertsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        low_stock = Medicine.objects.filter(quantity__lte=10)
        serializer = MedicineSerializer(low_stock, many=True)
        return Response({'ok': True, 'data': serializer.data})
