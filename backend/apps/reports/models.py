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

    title = models.CharField(max_length=200)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    content = models.TextField()
    generated_by = models.ForeignKey('users.Users', on_delete=models.SET_NULL, blank=True, null=True, related_name='reports')
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
