from rest_framework import viewsets, filters
from rest_framework.response import Response
from django.core.cache import cache
from .models import Patient
from .serializers import PatientSerializer

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    # Enable Search
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    # FIX: Use double underscore to search inside the 'name' relationship
    search_fields = ['name__first_name', 'name__second_name', 'name__phone_number']
    ordering_fields = ['register_date', 'name__first_name']

    def list(self, request, *args, **kwargs):
        """Overrides the default GET /api/patients/ list behavior with local caching."""

        # 1. Check if there are active search or ordering query params in the URL
        # If the user is searching or sorting, we bypass the cache to get fresh results.
        if request.query_params:
            return super().list(request, *args, **kwargs)

        cache_key = "global_patients_list"

        # 2. Try fetching data from your working memory cache
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        # 3. Cache Miss: Run the standard ModelViewSet database logic
        response = super().list(request, *args, **kwargs)

        # 4. Save the plain data array to cache for 15 minutes (900 seconds)
        cache.set(cache_key, response.data, timeout=900)

        return response