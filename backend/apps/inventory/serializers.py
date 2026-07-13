# In PHARMACY/apps/inventory/serializers.py

from rest_framework import serializers
from .models import Medicine

class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = ['id', 'name', 'quantity', 'price', 'date_added']