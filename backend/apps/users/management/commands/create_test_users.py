from django.core.management.base import BaseCommand
from apps.users.models import Users, Employee, Names


class Command(BaseCommand):
    help = "Create test users for all 10 roles"

    def handle(self, *args, **options):
        roles = [
            ("ADMIN", "admin2", "admin2@test.com"),
            ("DOCTOR", "doctor1", "doctor1@test.com"),
            ("CHEMIST", "chemist1", "chemist1@test.com"),
            ("STORE_MANAGER", "store_manager1", "store_manager1@test.com"),
            ("QUALITY_ASSURANCE", "qa1", "qa1@test.com"),
            ("TRIAGE", "triage1", "triage1@test.com"),
            ("NURSE", "nurse1", "nurse1@test.com"),
            ("RECEPTIONIST", "receptionist1", "receptionist1@test.com"),
            ("ACCOUNTANT", "accountant1", "accountant1@test.com"),
            ("LAB_TECH", "labtech1", "labtech1@test.com"),
        ]

        created = []
        for role, username, email in roles:
            if Users.objects.filter(username=username).exists():
                self.stdout.write(self.style.WARNING(f"User {username} already exists"))
                continue

            names = Names.objects.create(
                first_name=username.title(),
                second_name="User",
                third_name="",
                gender="M",
                age=30,
                phone_number="+254700000000",
            )
            user = Users.objects.create_user(
                username=username,
                password="password123",
                employee_type=role,
            )
            user.name = names
            user.save()
            Employee.objects.create(user=user, email=email)
            created.append(username)

        self.stdout.write(self.style.SUCCESS(f"Created users: {', '.join(created)}"))
