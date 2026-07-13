# apps/accounts/serializers.py
from rest_framework import serializers
from .models import Invoice, Payment

class PaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(source='received_by.user.username', read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'invoice', 'amount', 'method', 'reference_number', 'received_by', 'received_by_name', 'payment_date']
        read_only_fields = ['received_by', 'payment_date']

class InvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name.first_name', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.user.username', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'patient', 'patient_name', 'visit', 'prescription', 
            'total_amount', 'paid_amount', 'balance', 'status', 
            'issued_by', 'issued_by_name', 'issued_at', 'payments'
        ]
        read_only_fields = ['issued_by', 'paid_amount', 'status', 'issued_at']

    def get_balance(self, obj):
        return obj.total_amount - obj.paid_amount