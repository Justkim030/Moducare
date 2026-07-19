from rest_framework import viewsets, parsers
from rest_framework.permissions import IsAuthenticated
from .models import Document
from .serializers import DocumentSerializer

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all().select_related('uploaded_by')
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        # Safely attempt to get the employee profile tied to the user
        employee_profile = getattr(self.request.user, 'employee', None)
        
        # Save the document with the employee profile
        serializer.save(uploaded_by=employee_profile)

    def get_queryset(self):
        return super().get_queryset().select_related('uploaded_by')