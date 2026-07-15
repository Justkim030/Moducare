from rest_framework import serializers
from .models import Medicine

class MedicineSerializer(serializers.ModelSerializer):
    category = serializers.CharField(default='medication', read_only=True)
    current_stock = serializers.IntegerField(source='quantity', read_only=True)
    reorder_level = serializers.IntegerField(default=10, read_only=True)
    unit = serializers.CharField(default='units', read_only=True)
    last_restocked = serializers.CharField(source='date_added', read_only=True)
    supplier = serializers.CharField(default='', read_only=True)

    class Meta:
        model = Medicine
        fields = ['id', 'name', 'category', 'current_stock', 'reorder_level', 'unit', 'last_restocked', 'supplier', 'quantity', 'price', 'date_added']
