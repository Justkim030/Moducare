from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Report
from .serializers import ReportSerializer

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def scheduled(self, request):
        reports = self.get_queryset()
        serializer = self.get_serializer(reports, many=True)
        return Response({'ok': True, 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        try:
            report = Report.objects.get(pk=pk)
            return Response({'ok': True, 'message': f'Report {report.title} queued for execution'})
        except Report.DoesNotExist:
            return Response({'ok': False, 'error': 'Report not found'}, status=404)


class ReportScheduledListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reports = Report.objects.all()
        serializer = ReportSerializer(reports, many=True)
        return Response({'ok': True, 'data': serializer.data})


class ReportRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            report = Report.objects.get(pk=pk)
            return Response({'ok': True, 'message': f'Report {report.title} queued for execution'})
        except Report.DoesNotExist:
            return Response({'ok': False, 'error': 'Report not found'}, status=404)
