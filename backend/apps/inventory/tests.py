from django.test import TestCase
from .models import Medicine

class MedicineModelTests(TestCase):
    def test_create_and_str(self):
        m = Medicine.objects.create(name='Aspirin', quantity=10, price='1.50')
        self.assertEqual(str(m), 'Aspirin')
        self.assertEqual(m.quantity, 10)
