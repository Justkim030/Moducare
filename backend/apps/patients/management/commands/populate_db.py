import random
from faker import Faker
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from apps.patients.models import Patient
from apps.visits.models import Visit

Employee = get_user_model()
fake = Faker()

class Command(BaseCommand):
    help = 'Populates the database with 1000 dummy patients and their visit histories.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Checking for existing data...'))

        if Patient.objects.exists():
            self.stdout.write(self.style.WARNING('Database already populated. Skipping.'))
            return

        # 1. Get the Triage/Admin user you created
        try:
            triage_user = Employee.objects.filter(
                employee_type__in=['TRIAGE', 'ADMIN']
            ).first()
        except Employee.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                'No TRIAGE or ADMIN user found. Please create one first.'
            ))
            return
        
        if not triage_user:
            self.stdout.write(self.style.ERROR(
                'No TRIAGE or ADMIN user found. Please create one first.'
            ))
            return

        self.stdout.write(self.style.NOTICE(
            f'Creating 1000 patients using user: {triage_user.username}'
        ))

        # 2. Create 1000 patients in a loop
        for i in range(1000):
            patient = Patient.objects.create(
                first_name=fake.first_name(),
                second_name=fake.last_name(),
                age=random.randint(1, 95),
                gender=random.choice(['Male', 'Female', 'Other'])
            )

            # 3. Create 1-5 historical visits for each patient
            num_visits = random.randint(1, 5)
            for _ in range(num_visits):
                Visit.objects.create(
                    patient=patient,
                    registered_by=triage_user,
                    chief_complaint=fake.sentence(nb_words=5),
                    triage_level=random.choice(
                        ['LEVEL_3', 'LEVEL_4', 'LEVEL_5']
                    ),
                    status=Visit.VisitStatus.COMPLETE, # Mark as 'Complete' for history
                    
                    # Add dummy vitals
                    body_temp_celsius=round(random.uniform(36.1, 38.5), 1),
                    weight_kg=round(random.uniform(5.0, 120.0), 1),
                    bp_systolic=random.randint(90, 160),
                    bp_diastolic=random.randint(60, 100),
                    heart_rate=random.randint(60, 110)
                )
            
            if (i + 1) % 100 == 0:
                self.stdout.write(f'Created {i + 1} / 1000 patients...')

        self.stdout.write(self.style.SUCCESS(
            'Successfully created 1000 patients and their visit histories.'
        ))