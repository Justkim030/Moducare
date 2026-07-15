from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Operation, Activity
from .serializers import OperationSerializer, ActivitySerializer

class OperationViewSet(viewsets.ModelViewSet):
    queryset = Operation.objects.all()
    serializer_class = OperationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related(None)


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all().select_related('operation')
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('operation')
