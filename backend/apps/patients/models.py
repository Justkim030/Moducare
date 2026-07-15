from django.db import models
from apps.users.models import Names  # Import the correct class name

class Patient(models.Model):
    """
    Patient entity. 
    In your diagram, Patient links to Names via a Foreign Key (NAME_ID).
    We use OneToOneField so one Name belongs to exactly one Patient.
    """
    # This creates the 'NAME_ID(FK)' column from your diagram
    name = models.OneToOneField(Names, on_delete=models.CASCADE, db_index=True)
    
    # Using DateTimeField is usually better for 'register_date' to capture exact time
    register_date = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        # We access the name fields through the relationship
        return f"Patient: {self.name.first_name} {self.name.second_name}"