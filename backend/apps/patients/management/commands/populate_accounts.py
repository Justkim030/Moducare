from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from patients.models import Account, Patient, Employee
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Populate the accounts table from auth.User, Patient, and Employee entries'

    def handle(self, *args, **options):
        User = get_user_model()

        created = 0

        user_ct = ContentType.objects.get_for_model(User)
        for u in User.objects.all():
            if Account.objects.filter(content_type=user_ct, object_id=u.pk).exists():
                continue
            a = Account.objects.create(
                type='user',
                create_time=getattr(u, 'date_joined', None),
                name=getattr(u, 'username', None) or getattr(u, 'email', None),
                content_type=user_ct,
                object_id=u.pk,
                user=u,
            )
            created += 1

        patient_ct = ContentType.objects.get_for_model(Patient)
        for p in Patient.objects.all():
            if Account.objects.filter(content_type=patient_ct, object_id=p.pk).exists():
                continue
            Account.objects.create(
                type='patient',
                create_time=p.create_time,
                name=p.name,
                content_type=patient_ct,
                object_id=p.pk,
                patient=p,
            )
            created += 1

        # Employees
        employee_ct = ContentType.objects.get_for_model(Employee)
        for e in Employee.objects.all():
            if Account.objects.filter(content_type=employee_ct, object_id=e.pk).exists():
                continue
            Account.objects.create(
                type='employee',
                create_time=e.create_time,
                name=e.name,
                content_type=employee_ct,
                object_id=e.pk,
                employee=e,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Populated accounts: {created} new rows'))
