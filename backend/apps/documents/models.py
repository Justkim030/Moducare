from django.db import models

class Document(models.Model):
    title = models.CharField(max_length=200, db_index=True)
    file = models.FileField(upload_to='documents/')
    uploaded_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='documents', db_index=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['uploaded_by', 'uploaded_at'], name='idx_document_uploaded'),
        ]
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.title
