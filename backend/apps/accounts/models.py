# apps/accounts/models.py
from django.db import models

class Invoice(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PARTIAL = 'PARTIAL', 'Partially Paid'
        PAID = 'PAID', 'Fully Paid'

    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE)
    visit = models.ForeignKey('visits.Visits', on_delete=models.SET_NULL, null=True, blank=True)
    
    # We can link a prescription if this bill is specifically for meds
    prescription = models.ForeignKey('prescriptions.Prescription', on_delete=models.SET_NULL, null=True, blank=True)
    
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    status = models.CharField(
        max_length=20, 
        choices=PaymentStatus.choices, 
        default=PaymentStatus.PENDING
    )
    
    issued_by = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, related_name='invoices_issued')
    issued_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Invoice #{self.id} - {self.patient}"

class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', 'Cash'
        CARD = 'CARD', 'Credit/Debit Card'
        INSURANCE = 'INSURANCE', 'Insurance'
        MPESA = 'MPESA', 'M-Pesa'

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    reference_number = models.CharField(max_length=100, blank=True, null=True, help_text="Transaction ID or Insurance Number")
    
    received_by = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, related_name='payments_received')
    payment_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment of {self.amount} for Invoice #{self.invoice.id}"