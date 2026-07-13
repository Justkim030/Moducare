# apps/prescriptions/views.py
from django.db import transaction
from django.db.models import Q 
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import Prescription, PrescriptionItem
from .serializers import PrescriptionSerializer, PrescriptionItemSerializer
from .permissions import IsDoctor, IsChemist
from rest_framework.filters import OrderingFilter

class PrescriptionItemViewSet(viewsets.ModelViewSet):
    """ API endpoint for individual prescription items. """
    queryset = PrescriptionItem.objects.all()
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated] 

    # --- ADD THIS METHOD ---
    def perform_create(self, serializer):
        # 1. Get the prescription this item belongs to
        prescription = serializer.validated_data['prescription']
        
        # 2. Check if the prescription is locked
        if prescription.status != 'PENDING':
             raise ValidationError("Cannot add items to a prescription that is already paid or dispensed.")

        # 3. Automatically assign the patient from the prescription
        serializer.save(patient=prescription.patient)
    # -----------------------

    def perform_update(self, serializer):
        item = self.get_object()
        if item.prescription.status != 'PENDING':
            raise ValidationError("Cannot edit items after payment.")
        serializer.save()

    def perform_destroy(self, instance):
        # Prevent deleting if already paid/dispensed
        if instance.prescription.status != 'PENDING':
            raise ValidationError("Cannot delete items after payment.")
        instance.delete()


class PrescriptionViewSet(viewsets.ModelViewSet):
    queryset = Prescription.objects.all().order_by('-date_prescribed')
    serializer_class = PrescriptionSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['date_prescribed', 'patient__first_name', 'status']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Admin sees all
        if user.is_superuser or getattr(user, 'employee_type', '') == 'ADMIN':
            return queryset

        # DOCTOR: Filter by the 'employee' field on Prescription
        # This works because 'employee' is a ForeignKey to Employee model, 
        # and Employee has a 'user' field.
        if user.employee_type == 'DOCTOR':
            return queryset.filter(employee__user=user)
            
        # CHEMIST: Needs careful handling for 'dispensed_by'
        if user.employee_type == 'CHEMIST':
            # FIX 1: Get the Employee object safely
            try:
                employee_profile = user.employee # or user.profile
            except AttributeError:
                # If a chemist logs in but has no employee profile, they see nothing
                return queryset.none()

            return queryset.filter(
                Q(status__in=['PENDING', 'PAID']) | 
                Q(dispensed_by=employee_profile) # FIX 2: Pass Employee object, not User
            )
            
        return queryset

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsDoctor | IsAdminUser]
        elif self.action == 'dispense' or self.action == 'mark_as_paid':
            self.permission_classes = [IsChemist | IsAdminUser]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    def mark_as_paid(self, request, pk=None):
        prescription = self.get_object()
        if prescription.status != 'PENDING':
            return Response({'error': 'This prescription is not pending payment.'},
                            status=status.HTTP_400_BAD_REQUEST)
        prescription.status = 'PAID'
        prescription.save()
        serializer = self.get_serializer(prescription)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    @transaction.atomic 
    def dispense(self, request, pk=None):
        prescription = self.get_object()

        if prescription.status == 'DISPENSED':
            return Response({'error': 'This prescription has already been dispensed.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if prescription.status != 'PAID':
            return Response({'error': 'This prescription has not been paid for.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # FIX 3: Ensure we have an Employee profile to assign to 'dispensed_by'
        try:
            employee_profile = request.user.employee
        except AttributeError:
            return Response(
                {'error': 'User profile not found. Cannot dispense.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        for item in prescription.items.all():
            if item.medicine.quantity < item.quantity:
                raise ValidationError(f"Not enough stock for {item.medicine.name}. "
                                      f"Requested: {item.quantity}, Available: {item.medicine.quantity}")
            
            item.medicine.quantity -= item.quantity
            item.medicine.save()

        prescription.status = 'DISPENSED'
        prescription.dispensed_by = employee_profile # FIX 4: Assign Employee, not User
        prescription.save()

        serializer = self.get_serializer(prescription)
        return Response(serializer.data, status=status.HTTP_200_OK)