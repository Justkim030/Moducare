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

    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, related_name='referrals')
    referred_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='referrals_sent')
    referred_to = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='referrals_received')
    reason = models.TextField()
    referral_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)

    def __str__(self):
        return f"Referral - {self.patient}"
