from django.db import models

class Analytics(models.Model):
    metric_name = models.CharField(max_length=100, db_index=True)
    value = models.DecimalField(max_digits=15, decimal_places=2, db_index=True)
    category = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    recorded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.metric_name} - {self.value}"
