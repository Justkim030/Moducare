from django.db import models

class Employee(models.Model):
    user = models.ForeignKey('users.Users', on_delete=models.CASCADE, related_name='hr_employees')
    position = models.CharField(max_length=100)
    hire_date = models.DateField()
    department = models.ForeignKey('core.Department', on_delete=models.SET_NULL, blank=True, null=True, related_name='employees')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.position}"


class EmployeeProfile(models.Model):
    employee = models.OneToOneField('hr.Employee', on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"Profile - {self.employee.user.username}"


class Contract(models.Model):
    FULL_TIME = 'full_time'
    PART_TIME = 'part_time'
    CONTRACT = 'contract'

    CONTRACT_TYPES = [
        (FULL_TIME, 'Full Time'),
        (PART_TIME, 'Part Time'),
        (CONTRACT, 'Contract'),
    ]

    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='contracts')
    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPES)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50, default='active')

    def __str__(self):
        return f"{self.employee.user.username} - {self.contract_type}"


class TrainingRecord(models.Model):
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='training_records')
    training_name = models.CharField(max_length=200)
    completion_date = models.DateField()
    status = models.CharField(max_length=50, default='completed')

    def __str__(self):
        return f"{self.employee.user.username} - {self.training_name}"


class PerformanceReview(models.Model):
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='performance_reviews')
    review_date = models.DateField()
    rating = models.IntegerField()
    comments = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.employee.user.username} - {self.review_date}"


class PayrollRecord(models.Model):
    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='payroll_records')
    period = models.CharField(max_length=50)
    base_salary = models.DecimalField(max_digits=10, decimal_places=2)
    bonuses = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField()

    def __str__(self):
        return f"{self.employee.user.username} - {self.period}"


class TimeAttendance(models.Model):
    PRESENT = 'present'
    ABSENT = 'absent'
    LEAVE = 'leave'

    STATUS_CHOICES = [
        (PRESENT, 'Present'),
        (ABSENT, 'Absent'),
        (LEAVE, 'Leave'),
    ]

    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    check_in = models.TimeField(blank=True, null=True)
    check_out = models.TimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PRESENT)

    def __str__(self):
        return f"{self.employee.user.username} - {self.date}"


class LeaveRequest(models.Model):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'

    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (APPROVED, 'Approved'),
        (REJECTED, 'Rejected'),
    ]

    employee = models.ForeignKey('hr.Employee', on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)

    def __str__(self):
        return f"{self.employee.user.username} - {self.leave_type}"
