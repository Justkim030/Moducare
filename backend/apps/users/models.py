# apps/users/models.py
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class MyUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('The Username field must be set')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, password, **extra_fields)

class Names(models.Model):
    first_name = models.CharField(max_length=100)
    second_name = models.CharField(max_length=100)
    third_name = models.CharField(max_length=100, blank=True, null=True)
    gender = models.CharField(max_length=10)
    age = models.IntegerField()
    phone_number = models.CharField(max_length=15)

    def __str__(self):
        return f"{self.first_name} {self.second_name}"

class Users(AbstractBaseUser, PermissionsMixin):
    # --- UPDATED ROLES HERE ---
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "ICT / Admin"
        DOCTOR = "DOCTOR", "Doctor"
        CHEMIST = "CHEMIST", "Pharmacist"
        STORE_MANAGER = "STORE_MANAGER", "Store Manager"
        QUALITY_ASSURANCE = "QUALITY_ASSURANCE", "Quality Assurance Officer"
        
        # New Roles for General Hospital
        TRIAGE = "TRIAGE", "Triage Nurse"
        NURSE = "NURSE", "General Nurse (Wards)"
        RECEPTIONIST = "RECEPTIONIST", "Receptionist"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"
        LAB_TECH = "LAB_TECH", "Lab Technician"
        

    name = models.ForeignKey(Names, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    username = models.CharField(max_length=100, unique=True)
    
    # Updated to use choices
    employee_type = models.CharField(max_length=50, choices=Role.choices, default=Role.DOCTOR, db_index=True)
    
    is_active = models.BooleanField(default=True, db_index=True)
    is_staff = models.BooleanField(default=False, db_index=True)

    objects = MyUserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.username

class Employee(models.Model):
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    user = models.OneToOneField(Users, on_delete=models.CASCADE)
    email = models.EmailField()
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Employee: {self.user.username}"