
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from django.db import transaction
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer

class IsAccountantOrAdmin(BasePermission):
    """
    Allows access to Accountants OR Admins.
    
    """
    def has_permission(self, request, view):
        # 1. Check if user is logged in
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(request.user, 'employee_type', '') == 'ACCOUNTANT'


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().order_by('-issued_at')
    serializer_class = InvoiceSerializer
    
    def get_permissions(self):
        # Anyone logged in can CREATE a bill (e.g. Doctor)
        if self.action in ['create']:
            return [IsAuthenticated()]
            
        # For viewing/editing, use our custom combined permission
        return [IsAccountantOrAdmin()]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'employee'):
            serializer.save(issued_by=user.employee)
        else:
            serializer.save()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def record_payment(self, request, pk=None):
        invoice = self.get_object()
        
        serializer = PaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        amount = serializer.validated_data['amount']
        
        # Save payment
        received_by = getattr(request.user, 'employee', None)
        serializer.save(invoice=invoice, received_by=received_by)
        
        # Update Invoice Status
        invoice.paid_amount += amount
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = Invoice.PaymentStatus.PAID
            if invoice.prescription:
                invoice.prescription.status = 'PAID'
                invoice.prescription.save()
        elif invoice.paid_amount > 0:
            invoice.status = Invoice.PaymentStatus.PARTIAL
            
        invoice.save()
        
        return Response({
            'status': 'Payment recorded',
            'invoice_status': invoice.status,
            'balance': invoice.total_amount - invoice.paid_amount
        })