from django.db import models

class Notification(models.Model):
    recipient = models.ForeignKey('users.Users', on_delete=models.CASCADE, related_name='notifications', db_index=True)
    title = models.CharField(max_length=200, db_index=True)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.title} - {self.recipient.username}"
