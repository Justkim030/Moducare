from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Analytics
from .serializers import AnalyticsSerializer

class AnalyticsViewSet(viewsets.ModelViewSet):
    queryset = Analytics.objects.all()
    serializer_class = AnalyticsSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        return Response({
            'ok': True,
            'stats': {
                'totalPatients': 0,
                'activePatients': 0,
                'totalEncounters': 0,
                'totalLabOrders': 0,
                'pendingLabOrders': 0,
                'totalDispensing': 0,
                'totalAppointments': 0,
                'scheduledAppointments': 0,
                'totalNotifications': 0,
                'unreadNotifications': 0,
                'totalInventory': 0,
                'lowStockItems': 0,
                'totalReferrals': 0,
                'pendingReferrals': 0,
            }
        })


class AnalyticsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'ok': True,
            'stats': {
                'totalPatients': 0,
                'activePatients': 0,
                'totalEncounters': 0,
                'totalLabOrders': 0,
                'pendingLabOrders': 0,
                'totalDispensing': 0,
                'totalAppointments': 0,
                'scheduledAppointments': 0,
                'totalNotifications': 0,
                'unreadNotifications': 0,
                'totalInventory': 0,
                'lowStockItems': 0,
                'totalReferrals': 0,
                'pendingReferrals': 0,
            }
        })
