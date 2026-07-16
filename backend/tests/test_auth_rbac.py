import pytest
from rest_framework.test import APIClient
from apps.users.models import Users, Employee, Names


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
