from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Referral
from .serializers import ReferralSerializer

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.all().select_related('patient__name', 'referred_by', 'referred_to')
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('patient__name', 'referred_by', 'referred_to')
