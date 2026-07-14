from .serializers import IncidentReportSerializer
from .models import IncidentReport
from rest_framework import viewsets, filters
from rest_framework.response import Response
from django.core.cache import cache

class IncidentReportViewSet(viewsets.ModelViewSet):
    queryset = IncidentReport.objects.all()
    serializer_class = IncidentReportSerializer

    # Enable Search
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    # FIX: Use double underscore to search inside the 'name' relationship
    search_fields = ['employee__name', 'patient__name']
    ordering_fields = ['incident_date', 'employee__name']

    def list(self, request, *args, **kwargs):
        """Overrides the default GET /api/incident-reports/ list behavior with local caching."""

        if request.query_params:
            return super().list(request, *args, **kwargs)

        cache_key = "global_incident_reports_list"

        # 2. Try fetching data from your working memory cache
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        # 3. Cache Miss: Run the standard ModelViewSet database logic
        response = super().list(request, *args, **kwargs)

        # 4. Save the plain data array to cache for 15 minutes (900 seconds)
        cache.set(cache_key, response.data, timeout=900)

        return response