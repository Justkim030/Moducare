from django.db import models

class Department(models.Model):
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name', 'created_at'], name='idx_dept_name_created'),
        ]
        ordering = ['name']

    def __str__(self):
        return self.name


class Role(models.Model):
    name = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True, null=True)
    department = models.ForeignKey('core.Department', on_delete=models.CASCADE, related_name='roles', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['department', 'name'], name='idx_role_dept_name'),
        ]
        ordering = ['name']

    def __str__(self):
        return self.name
