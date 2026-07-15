from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Operation, Activity, CalendarEvent
from .serializers import OperationSerializer, ActivitySerializer, CalendarEventSerializer

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


class CalendarEventViewSet(viewsets.ModelViewSet):
    queryset = CalendarEvent.objects.all().select_related('employee')
    serializer_class = CalendarEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset().select_related('employee')
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if start and end:
            qs = qs.filter(start_time__gte=start, start_time__lte=end)
        return qs

