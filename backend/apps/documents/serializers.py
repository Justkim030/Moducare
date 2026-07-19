from rest_framework import serializers
from .models import Document

class DocumentSerializer(serializers.ModelSerializer):
    # This safely gets the string representation of the Employee
    # (Whatever you defined in the Employee model's __str__ method)
    uploaded_by_name = serializers.StringRelatedField(source='uploaded_by', read_only=True)

    class Meta:
        model = Document
        # Explicitly listing fields bypasses the _meta crash
        fields = ['id', 'title', 'file', 'description', 'uploaded_at', 'uploaded_by_name']