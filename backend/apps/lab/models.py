# apps/lab/models.py
from django.db import models

class LabTest(models.Model):
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    is_available = models.BooleanField(default=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name', 'is_available'], name='idx_labtest_name_avail'),
        ]
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (${self.price})"

class TestRequest(models.Model):
    class TestStatus(models.TextChoices):
        REQUESTED = 'REQUESTED', 'Requested'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'

    visit = models.ForeignKey('visits.Visits', on_delete=models.CASCADE, related_name='lab_requests', db_index=True)
    test = models.ForeignKey(LabTest, on_delete=models.CASCADE, db_index=True)
    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, db_index=True)
    doctor = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, related_name='tests_ordered', db_index=True)
    lab_tech = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='tests_conducted', db_index=True)
    status = models.CharField(max_length=20, choices=TestStatus.choices, default=TestStatus.REQUESTED, db_index=True)
    result_notes = models.TextField(blank=True, null=True)
    requested_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'status'], name='idx_lab_patient_status'),
            models.Index(fields=['doctor', 'status'], name='idx_lab_doctor_status'),
            models.Index(fields=['status', 'requested_at'], name='idx_lab_status_date'),
        ]
        ordering = ['-requested_at']

    def __str__(self):
        return f"{self.test.name} for {self.patient}"