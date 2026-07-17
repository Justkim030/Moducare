from django.db import models

from apps.users.models import Employee

class Appointment(models.Model):
    SCHEDULED = 'scheduled'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (SCHEDULED, 'Scheduled'),
        (COMPLETED, 'Completed'),
        (CANCELLED, 'Cancelled'),
    ]

    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, related_name='appointments', db_index=True)

    doctor = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True)
    appointment_date = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=SCHEDULED, db_index=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['doctor', 'appointment_date'], name='idx_appt_doctor_date'),
            models.Index(fields=['patient', 'appointment_date'], name='idx_appt_patient_date'),
            models.Index(fields=['status', 'appointment_date'], name='idx_appt_status_date'),
        ]
        ordering = ['appointment_date']

    def __str__(self):
        return f"Appointment - {self.appointment_date}"
