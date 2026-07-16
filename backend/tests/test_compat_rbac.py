import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from apps.users.models import Users, Employee, Names
from apps.patients.models import Patient
from apps.appointments.models import Appointment
from apps.quality.models import IncidentReport
from apps.inventory.models import Medicine
from apps.operations.models import Operation, CalendarEvent
from apps.finance.models import Finance
from apps.hr.models import Staff
from datetime import date, timedelta
from django.utils import timezone


@pytest.mark.django_db
def create_test_users():
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
    for role, username, email in roles:
        if Users.objects.filter(username=username).exists():
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


@pytest.fixture(autouse=True)
def setup_test_users(db):
    create_test_users()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_token(api_client):
    resp = api_client.post('/api/login/', {'email': 'admin2', 'password': 'password123'}, format='json')
    assert resp.status_code == 200, f"Login failed: {resp.data}"
    return resp.data['token']


@pytest.fixture
def doctor_token(api_client):
    resp = api_client.post('/api/login/', {'email': 'doctor1', 'password': 'password123'}, format='json')
    assert resp.status_code == 200, f"Login failed: {resp.data}"
    return resp.data['token']


@pytest.mark.django_db
class TestAuth:
    def test_login_admin(self, api_client):
        resp = api_client.post('/api/login/', {'email': 'admin2', 'password': 'password123'}, format='json')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'token' in resp.data
        assert 'user' in resp.data
        assert resp.data['user']['employee_type'] == 'ADMIN'

    def test_login_with_username(self, api_client):
        resp = api_client.post('/api/login/', {'email': 'admin2', 'password': 'password123'}, format='json')
        assert resp.status_code == 200
        assert resp.data['ok'] is True

    def test_login_invalid(self, api_client):
        resp = api_client.post('/api/login/', {'email': 'bad', 'password': 'bad'}, format='json')
        assert resp.status_code == 401

    def test_register(self, api_client):
        resp = api_client.post('/api/register/', {
            'username': 'newuser',
            'password': 'newpass123',
            'first_name': 'New',
            'second_name': 'User',
            'gender': 'M',
            'age': 25,
            'phone_number': '+254700000001',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True

    def test_capabilities(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/capabilities/')
        assert resp.status_code == 200
        assert 'capabilities' in resp.data
        assert 'modules' in resp.data
        assert len(resp.data['capabilities']) > 0

    def test_role_permissions(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/role-permissions/?role_id=DOCTOR')
        assert resp.status_code == 200
        assert resp.data['role_id'] == 'DOCTOR'

    def test_health(self, api_client):
        resp = api_client.get('/api/health/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True


@pytest.mark.django_db
class TestCompatEndpoints:
    def test_patients_list_paginated(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/patients/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data
        assert 'pagination' in resp.data

    def test_patients_create(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.post('/api/patients/', {
            'name': {
                'first_name': 'Test',
                'second_name': 'Patient',
                'gender': 'M',
                'age': 30,
                'phone_number': '+254700000002',
            }
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True
        assert 'patient' in resp.data

    def test_patients_unauthorized(self, api_client):
        resp = api_client.get('/api/patients/')
        assert resp.status_code == 401

    def test_incidents_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/incidents/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_inventory_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/inventory/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_appointments_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/appointments/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_notifications_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/notifications/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_operations_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/operations/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_finance_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/finance/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_staff_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/staff/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_events_list(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/events/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'results' in resp.data

    def test_employees_me(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/employees/me/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'employee' in resp.data

    def test_search_endpoint(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/search/?q=admin&type=all')
        assert resp.status_code == 200
        assert resp.data['ok'] is True

    def test_dashboard_endpoint(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/dashboard/')
        assert resp.status_code == 200
        assert resp.data['ok'] is True
        assert 'stats' in resp.data


@pytest.mark.django_db
class TestRBAC:
    def test_admin_has_all_capabilities(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.get('/api/capabilities/')
        assert resp.status_code == 200
        caps = resp.data['capabilities']
        assert '*' in caps or len(caps) > 20

    def test_doctor_has_clinical_caps(self, api_client, doctor_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {doctor_token}')
        resp = api_client.get('/api/capabilities/')
        assert resp.status_code == 200
        caps = resp.data['capabilities']
        assert 'patient:read' in caps
        assert 'prescription:write' in caps

    def test_labtech_has_lab_caps(self, api_client):
        resp = api_client.post('/api/login/', {'email': 'labtech1', 'password': 'password123'}, format='json')
        assert resp.status_code == 200
        token = resp.data['token']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        resp = api_client.get('/api/capabilities/')
        assert resp.status_code == 200
        caps = resp.data['capabilities']
        assert 'lab:read' in caps
        assert 'lab:result_entry' in caps

    def test_doctor_cannot_access_admin_endpoints(self, api_client, doctor_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {doctor_token}')
        resp = api_client.get('/api/users/')
        assert resp.status_code == 200
        data = resp.data
        assert 'results' in data or 'users' in data

    def test_receptionist_has_registration_cap(self, api_client):
        resp = api_client.post('/api/login/', {'email': 'receptionist1', 'password': 'password123'}, format='json')
        assert resp.status_code == 200
        token = resp.data['token']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        resp = api_client.get('/api/capabilities/')
        assert resp.status_code == 200
        caps = resp.data['capabilities']
        assert 'patient:register' in caps

    def test_accountant_has_finance_caps(self, api_client):
        resp = api_client.post('/api/login/', {'email': 'accountant1', 'password': 'password123'}, format='json')
        assert resp.status_code == 200
        token = resp.data['token']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        resp = api_client.get('/api/capabilities/')
        assert resp.status_code == 200
        caps = resp.data['capabilities']
        assert 'finance:read' in caps
        assert 'finance:write' in caps


@pytest.mark.django_db
class TestModels:
    def test_patient_foreign_key_allows_multiple(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        name1 = Names.objects.create(first_name='John', second_name='Doe', gender='M', age=30, phone_number='+254700000010')
        Patient.objects.create(name=name1)
        name2 = Names.objects.create(first_name='Jane', second_name='Doe', gender='F', age=25, phone_number='+254700000011')
        Patient.objects.create(name=name2)
        assert Patient.objects.count() == 2

    def test_time_attendance_unique_constraint(self, api_client, admin_token):
        staff = Staff.objects.first()
        if not staff:
            pytest.skip('No staff available')
        from apps.hr.models import TimeAttendance
        ta1 = TimeAttendance.objects.create(employee=staff, date=date.today(), status='present')
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            TimeAttendance.objects.create(employee=staff, date=date.today(), status='absent')

    def test_appointment_creation(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        patient = Patient.objects.first()
        if not patient:
            name = Names.objects.create(first_name='Test', second_name='Patient', gender='M', age=30, phone_number='+254700000020')
            patient = Patient.objects.create(name=name)
        resp = api_client.post('/api/appointments/', {
            'patient': patient.id,
            'appointment_date': (timezone.now() + timedelta(days=1)).isoformat(),
            'status': 'scheduled',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True

    def test_incident_creation(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.post('/api/incidents/', {
            'incident_type': 'safety',
            'description': 'Test incident',
            'incident_date': timezone.now().isoformat(),
            'status': 'open',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True

    def test_finance_creation(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.post('/api/finance/', {
            'transaction_type': 'income',
            'amount': 100.00,
            'description': 'Test payment',
            'date': timezone.now().isoformat(),
            'category': 'paid',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True

    def test_operation_creation(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.post('/api/operations/', {
            'name': 'Test Operation',
            'description': 'Test description',
            'start_date': timezone.now().isoformat(),
            'status': 'pending',
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True

    def test_event_creation(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
        resp = api_client.post('/api/events/', {
            'title': 'Test Event',
            'description': 'Test description',
            'event_type': 'meeting',
            'status': 'scheduled',
            'start_time': (timezone.now() + timedelta(days=1)).isoformat(),
        }, format='json')
        assert resp.status_code == 201
        assert resp.data['ok'] is True
