# In apps/inventory/management/commands/populate_medicines.py

import random
from faker import Faker
from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from apps.inventory.models import Medicine

fake = Faker()

# --- Lists to generate realistic-sounding names ---
MED_PREFIXES = [
    'Ato', 'Lisi', 'Metfo', 'Amlo', 'Azithro', 'Los', 'Salbu', 'Metop',
    'Panto', 'Rosuva', 'Omep', 'Clopi', 'Trazo', 'Serta', 'Escita',
    'Bupro', 'Fluoxe', 'Dulo', 'Venla', 'Mirtaz', 'Para', 'Ibu',
]
MED_SUFFIXES = [
    'vastatin', 'nopril', 'formin', 'dipine', 'mycin', 'sartan', 'tamol',
    'prolol', 'prazole', 'statin', 'grel', 'done', 'line', 'lopram',
    'pion', 'tine', 'xetine', 'faxine', 'zapine', 'cetamol', 'profen',
]
DOSAGES = [
    '10mg', '20mg', '40mg', '50mg', '100mg', '250mg', '500mg', '800mg'
]

class Command(BaseCommand):
    help = 'Populates the database with 1000 dummy medicines.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Checking for existing medicine data...'))

        if Medicine.objects.exists():
            self.stdout.write(self.style.WARNING('Medicine data already exists. Skipping.'))
            return

        self.stdout.write(self.style.NOTICE('Creating 1000 dummy medicines...'))
        
        created_count = 0
        
        # Use a while loop to ensure we create 1000 *unique* medicines
        while created_count < 1000:
            try:
                # 1. Generate a realistic-ish name
                prefix = random.choice(MED_PREFIXES)
                suffix = random.choice(MED_SUFFIXES)
                dosage = random.choice(DOSAGES)
                
                # Combine to create a unique name (e.g., "Lisi-pril 10mg (Generic)")
                # Adding fake.word() helps ensure uniqueness
                name = f"{prefix}{suffix} {dosage} ({fake.word().capitalize()})"

                # 2. Generate quantity and price
                quantity = random.randint(5, 500)
                price = round(random.uniform(2.50, 150.00), 2)

                # 3. Create the medicine
                Medicine.objects.create(
                    name=name,
                    quantity=quantity,
                    price=price
                )
                
                created_count += 1
                
                if created_count % 100 == 0:
                    self.stdout.write(f'Created {created_count} / 1000 medicines...')

            except IntegrityError:
                # This happens if the 'name' was not unique.
                # We simply 'pass' and let the loop try again.
                pass

        self.stdout.write(self.style.SUCCESS(
            'Successfully created 1000 dummy medicines.'
        ))