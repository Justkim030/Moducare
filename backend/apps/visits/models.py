# apps/visits/models.py
from django.db import models

class Triage(models.Model):
    chief_complaint = models.TextField(blank=True, null=True)
    # Optional, so it can be reused for Ward Logs
    triage_level = models.CharField(max_length=50, blank=True, null=True) 
    body_temp = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bp_diastolic = models.IntegerField(null=True, blank=True)
    bp_systolic = models.IntegerField(null=True, blank=True)
    heart_rate = models.IntegerField(null=True, blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"Triage ID: {self.id}"

class Visits(models.Model):
    class VisitStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending (Triage/Doctor)'
        CONSULTATION = 'CONSULTATION', 'Consultation'
        LAB_WORK = 'LAB_WORK', 'Lab Investigation'
        ADMITTED = 'ADMITTED', 'In-Patient'
        DISCHARGED = 'DISCHARGED', 'Discharged'
        COMPLETED = 'COMPLETED', 'Completed'

    class PatientType(models.TextChoices):
        OUTPATIENT = 'OPD', 'Out-Patient'
        INPATIENT = 'IPD', 'In-Patient'

    visit_date = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=50, choices=VisitStatus.choices, default=VisitStatus.PENDING, db_index=True)
    patient_type = models.CharField(max_length=10, choices=PatientType.choices, default=PatientType.OUTPATIENT, db_index=True)
    ward = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    bed_number = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    consultation_notes = models.TextField(blank=True, null=True)
    pharmacy_notes = models.TextField(blank=True, null=True)
    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, db_index=True)
    registered_by = models.ForeignKey('hr.Staff', on_delete=models.SET_NULL, null=True, db_index=True)
    triage = models.ForeignKey(Triage, on_delete=models.CASCADE, related_name='visit_initial_triage', db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'status'], name='idx_visit_patient_status'),
            models.Index(fields=['status', 'visit_date'], name='idx_visit_status_date'),
        ]
        ordering = ['-visit_date']

    def __str__(self):
        return f"Visit {self.id}"

class WardLog(models.Model):
    visit = models.ForeignKey(Visits, on_delete=models.CASCADE, related_name='ward_logs', db_index=True)
    nurse = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    triage = models.ForeignKey(Triage, on_delete=models.CASCADE, null=True, db_index=True)
    notes = models.TextField(help_text="Nursing notes / Observation")

    class Meta:
        indexes = [
            models.Index(fields=['visit', 'timestamp'], name='idx_wardlog_visit_ts'),
            models.Index(fields=['nurse', 'timestamp'], name='idx_wardlog_nurse_ts'),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"Log for {self.visit.patient} at {self.timestamp}"