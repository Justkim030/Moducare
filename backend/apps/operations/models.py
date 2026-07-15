from django.db import models

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
