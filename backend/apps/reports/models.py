from django.db import models

class Report(models.Model):
    SUMMARY = 'summary'
    DETAILED = 'detailed'
    CUSTOM = 'custom'

    REPORT_TYPES = [
        (SUMMARY, 'Summary'),
        (DETAILED, 'Detailed'),
        (CUSTOM, 'Custom'),
    ]

    title = models.CharField(max_length=200, db_index=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES, db_index=True)
    content = models.TextField()
    generated_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='reports', db_index=True)
    generated_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return self.title
