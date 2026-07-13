# apps/lab/models.py
from django.db import models

class LabTest(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (${self.price})"

class TestRequest(models.Model):
    class TestStatus(models.TextChoices):
        REQUESTED = 'REQUESTED', 'Requested'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'

    visit = models.ForeignKey('visits.Visits', on_delete=models.CASCADE, related_name='lab_requests')
    test = models.ForeignKey(LabTest, on_delete=models.CASCADE)
    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE)
    
    doctor = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, related_name='tests_ordered')
    lab_tech = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='tests_conducted')
    
    status = models.CharField(max_length=20, choices=TestStatus.choices, default=TestStatus.REQUESTED)
    result_notes = models.TextField(blank=True, null=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.test.name} for {self.patient}"