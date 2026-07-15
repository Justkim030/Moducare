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
        ADMITTED = 'ADMITTED', 'Admitted (In-Patient)'
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
    registered_by = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, db_index=True)
    # This is the Initial Triage
    triage = models.ForeignKey(Triage, on_delete=models.CASCADE, related_name='visit_initial_triage', db_index=True)

    def __str__(self):
        return f"Visit {self.id}"

class WardLog(models.Model):
    visit = models.ForeignKey(Visits, on_delete=models.CASCADE, related_name='ward_logs', db_index=True)
    nurse = models.ForeignKey('users.Employee', on_delete=models.SET_NULL, null=True, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # --- FIX: Added null=True here ---
    triage = models.ForeignKey(Triage, on_delete=models.CASCADE, null=True, db_index=True)
    
    notes = models.TextField(help_text="Nursing notes / Observation")

    def __str__(self):
        return f"Log for {self.visit.patient} at {self.timestamp}"