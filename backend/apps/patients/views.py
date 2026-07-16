from rest_framework import viewsets, filters
from rest_framework.response import Response
from django.core.cache import cache
from .models import Patient
from .serializers import PatientSerializer

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().select_related('name')
    serializer_class = PatientSerializer

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name__first_name', 'name__second_name', 'name__phone_number']
    ordering_fields = ['register_date', 'name__first_name']

    def get_queryset(self):
        return super().get_queryset().select_related('name')

    def _invalidate_cache(self):
        cache.delete("global_patients_list")

    def list(self, request, *args, **kwargs):
        if request.query_params:
            return super().list(request, *args, **kwargs)

        cache_key = "global_patients_list"
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return Response(cached_data)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=900)
        return response

    def create(self, request, *args, **kwargs):
        self._invalidate_cache()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._invalidate_cache()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._invalidate_cache()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._invalidate_cache()
        return super().destroy(request, *args, **kwargs)