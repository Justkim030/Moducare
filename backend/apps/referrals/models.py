from django.db import models

class Referral(models.Model):
    PENDING = 'pending'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'
    COMPLETED = 'completed'

    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected'),
        (COMPLETED, 'Completed'),
    ]

    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, related_name='referrals', db_index=True)
    referred_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='referrals_sent', db_index=True)
    referred_to = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='referrals_received', db_index=True)
    reason = models.TextField()
    referral_date = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'status'], name='idx_referral_patient_status'),
            models.Index(fields=['referred_by', 'referral_date'], name='idx_referral_by_date'),
            models.Index(fields=['status', 'referral_date'], name='idx_referral_status_date'),
        ]
        ordering = ['-referral_date']

    def __str__(self):
        return f"Referral - {self.patient}"
