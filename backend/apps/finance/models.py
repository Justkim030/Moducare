from django.db import models

class Finance(models.Model):
    INCOME = 'income'
    EXPENSE = 'expense'

    TRANSACTION_TYPES = [
        (INCOME, 'Income'),
        (EXPENSE, 'Expense'),
    ]

    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, db_index=True)
    description = models.TextField(blank=True, null=True)
    date = models.DateTimeField(db_index=True)
    category = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['transaction_type', 'date'], name='idx_finance_type_date'),
            models.Index(fields=['category', 'date'], name='idx_finance_category_date'),
        ]
        ordering = ['-date']

    def __str__(self):
        return f"{self.transaction_type} - {self.amount}"
