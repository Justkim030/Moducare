from django.db import models

class Medicine(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    quantity = models.IntegerField(db_index=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    date_added = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name', 'quantity'], name='idx_medicine_name_qty'),
        ]
        ordering = ['name']

    def __str__(self):
        return self.name