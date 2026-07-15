from django.db import models

class Staff(models.Model):
    user = models.ForeignKey('users.Users', on_delete=models.CASCADE, related_name='hr_staff_records', db_index=True)
    position = models.CharField(max_length=100, db_index=True)
    hire_date = models.DateField(db_index=True)
    department = models.ForeignKey('core.Department', on_delete=models.SET_NULL, blank=True, null=True, related_name='staff_records', db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'position'], name='idx_staff_user_position'),
            models.Index(fields=['department', 'is_active'], name='idx_staff_dept_active'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.position}"


class EmployeeProfile(models.Model):
    employee = models.OneToOneField('hr.Staff', on_delete=models.CASCADE, related_name='profile', db_index=True)
    bio = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        ordering = ['employee__user__username']

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

    employee = models.ForeignKey('hr.Staff', on_delete=models.CASCADE, related_name='contracts', db_index=True)
    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPES, db_index=True)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(blank=True, null=True, db_index=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    status = models.CharField(max_length=50, default='active', db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'contract_type'], name='idx_contract_emp_type'),
            models.Index(fields=['status', 'start_date'], name='idx_contract_status_start'),
        ]
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.employee.user.username} - {self.contract_type}"


class TrainingRecord(models.Model):
    employee = models.ForeignKey('hr.Staff', on_delete=models.CASCADE, related_name='training_records', db_index=True)
    training_name = models.CharField(max_length=200, db_index=True)
    completion_date = models.DateField(db_index=True)
    status = models.CharField(max_length=50, default='completed', db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'completion_date'], name='idx_training_emp_date'),
            models.Index(fields=['status', 'completion_date'], name='idx_training_status_date'),
        ]
        ordering = ['-completion_date']

    def __str__(self):
        return f"{self.employee.user.username} - {self.training_name}"


class PerformanceReview(models.Model):
    employee = models.ForeignKey('hr.Staff', on_delete=models.CASCADE, related_name='performance_reviews', db_index=True)
    review_date = models.DateField(db_index=True)
    rating = models.IntegerField(db_index=True)
    comments = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'review_date'], name='idx_review_emp_date'),
            models.Index(fields=['rating', 'review_date'], name='idx_review_rating_date'),
        ]
        ordering = ['-review_date']

    def __str__(self):
        return f"{self.employee.user.username} - {self.review_date}"


class PayrollRecord(models.Model):
    employee = models.ForeignKey('hr.Staff', on_delete=models.CASCADE, related_name='payroll_records', db_index=True)
    period = models.CharField(max_length=50, db_index=True)
    base_salary = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    bonuses = models.DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    payment_date = models.DateField(db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'period'], name='idx_payroll_emp_period'),
            models.Index(fields=['payment_date', 'period'], name='idx_payroll_date_period'),
        ]
        ordering = ['-payment_date']

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

    employee = models.ForeignKey('hr.Staff', on_delete=models.CASCADE, related_name='attendance_records', db_index=True)
    date = models.DateField(db_index=True)
    check_in = models.TimeField(blank=True, null=True)
    check_out = models.TimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PRESENT, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['employee', 'date'], name='unique_employee_date'),
        ]
        indexes = [
            models.Index(fields=['employee', 'date'], name='idx_attendance_emp_date'),
            models.Index(fields=['date', 'status'], name='idx_attendance_date_status'),
        ]
        ordering = ['-date']

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

    employee = models.ForeignKey('hr.Staff', on_delete=models.CASCADE, related_name='leave_requests', db_index=True)
    leave_type = models.CharField(max_length=50, db_index=True)
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['employee', 'status'], name='idx_leave_emp_status'),
            models.Index(fields=['status', 'start_date'], name='idx_leave_status_start'),
        ]
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.employee.user.username} - {self.leave_type}"
