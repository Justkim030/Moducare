from django.db import models

class Audit(models.Model):
    CREATE = 'create'
    UPDATE = 'update'
    DELETE = 'delete'
    VIEW = 'view'

    ACTION_CHOICES = [
        (CREATE, 'Create'),
        (UPDATE, 'Update'),
        (DELETE, 'Delete'),
        (VIEW, 'View'),
    ]

    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)
    object_id = models.CharField(max_length=100, db_index=True)
    changes = models.TextField(blank=True, null=True)
    performed_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='audits', db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['model_name', 'object_id', 'timestamp'], name='idx_audit_model_object_ts'),
            models.Index(fields=['action', 'timestamp'], name='idx_audit_action_ts'),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} {self.model_name} - {self.timestamp}"
