from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Referral
from .serializers import ReferralSerializer

class ReferralViewSet(viewsets.ModelViewSet):
    queryset = Referral.objects.all()
    serializer_class = ReferralSerializer
    permission_classes = [IsAuthenticated]
