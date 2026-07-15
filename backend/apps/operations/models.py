from django.db import models
from apps.users.models import Users

class CalendarEvent(models.Model):
    EVENT_TYPES = [
        ('shift', 'Staff Shift'),
        ('meeting', 'Meeting'),
        ('appointment', 'Appointment'),
        ('holiday', 'Holiday'),
        ('training', 'Training'),
    ]
    STATUSES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    title = models.CharField(max_length=200, db_index=True)
    description = models.TextField(blank=True, null=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='meeting', db_index=True)
    status = models.CharField(max_length=20, choices=STATUSES, default='scheduled', db_index=True)
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(blank=True, null=True, db_index=True)
    color = models.CharField(max_length=20, default='#3b82f6')
    employee = models.ForeignKey(Users, on_delete=models.SET_NULL, blank=True, null=True, related_name='calendar_events', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['event_type', 'start_time'], name='idx_event_type_start'),
            models.Index(fields=['status', 'start_time'], name='idx_event_status_start'),
            models.Index(fields=['employee', 'start_time'], name='idx_event_employee_start'),
        ]
        ordering = ['start_time']

    def __str__(self):
        return self.title


class Operation(models.Model):
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateTimeField(db_index=True)
    end_date = models.DateTimeField(blank=True, null=True, db_index=True)
    status = models.CharField(max_length=50, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'start_date'], name='idx_operation_status_start'),
        ]
        ordering = ['-start_date']

    def __str__(self):
        return self.name


class Activity(models.Model):
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)
    operation = models.ForeignKey('operations.Operation', on_delete=models.CASCADE, related_name='activities', db_index=True)
    status = models.CharField(max_length=50, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['operation', 'status'], name='idx_activity_operation_status'),
            models.Index(fields=['status', 'created_at'], name='idx_activity_status_created'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return self.name
