from django.db import models

class Medicine(models.Model):
    name = models.CharField(max_length=200)
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name