from django.db import models
from apps.users.models import Names  # Import the correct class name

class Patient(models.Model):
    name = models.OneToOneField(Names, on_delete=models.CASCADE, db_index=True)
    register_date = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name', 'register_date'], name='idx_patient_name_reg'),
        ]
        ordering = ['-register_date']

    def __str__(self):
        return f"Patient: {self.name.first_name} {self.name.second_name}"