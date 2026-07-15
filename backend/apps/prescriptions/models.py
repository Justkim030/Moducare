# apps/prescriptions/models.py
from django.db import models

class Prescription(models.Model):
    date_prescribed = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=50, db_index=True)
    employee = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, related_name='prescribed_by', db_index=True)
    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, db_index=True)
    visit = models.ForeignKey('visits.Visits', on_delete=models.CASCADE, db_index=True)
    dispensed_by = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='dispensed_by', db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'status'], name='idx_rx_patient_status'),
            models.Index(fields=['employee', 'date_prescribed'], name='idx_rx_emp_date'),
        ]
        ordering = ['-date_prescribed']

    def __str__(self):
        return f"Prescription #{self.id}"

class PrescriptionItem(models.Model):
    quantity = models.IntegerField()
    notes = models.TextField(blank=True)
    medicine = models.ForeignKey('inventory.Medicine', on_delete=models.CASCADE, db_index=True)
    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, db_index=True)
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='items', null=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['prescription', 'medicine'], name='idx_item_rx_med'),
        ]
        ordering = ['id']

    def __str__(self):
        return f"Item for {self.patient}"