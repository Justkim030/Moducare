from django.db import models

class Analytics(models.Model):
    metric_name = models.CharField(max_length=100, db_index=True)
    value = models.DecimalField(max_digits=15, decimal_places=2, db_index=True)
    category = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['metric_name', 'recorded_at'], name='idx_analytics_metric_date'),
            models.Index(fields=['category', 'recorded_at'], name='idx_analytics_category_date'),
        ]
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.metric_name} - {self.value}"
