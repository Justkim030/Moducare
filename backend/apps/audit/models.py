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

    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    changes = models.TextField(blank=True, null=True)
    performed_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='audits')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} {self.model_name} - {self.timestamp}"
