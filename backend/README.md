# ModuCare Backend

Django REST Framework backend for the ModuCare Management System.

## Prerequisites

- Python 3.12+
- pip

## Setup

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
.venv\Scripts\activate   # Windows
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create test users for all roles
python manage.py create_test_users

# Start development server
python manage.py runserver 8000
```

## Project Structure

```
backend/
├── manage.py               # Django CLI entry point
├── backend/                # Django project package
│   ├── __init__.py
│   ├── settings.py         # Django settings
│   ├── urls.py             # Root URL configuration
│   ├── wsgi.py             # WSGI config
│   └── asgi.py             # ASGI config
├── apps/                   # 19 Django applications
│   ├── users/              # Authentication, RBAC, employees
│   ├── patients/           # Patient management
│   ├── visits/             # Visits, triage, ward logs
│   ├── prescriptions/      # Prescriptions & items
│   ├── lab/                # Lab tests & requests
│   ├── inventory/          # Medicines & stock
│   ├── appointments/       # Appointments
│   ├── accounts/           # Invoices & payments
│   ├── finance/            # Finance transactions
│   ├── hr/                 # HR: staff, contracts, payroll, attendance, leave
│   ├── analytics/          # Analytics metrics
│   ├── reports/            # Reports
│   ├── audit/              # Audit logs
│   ├── communications/     # Notifications
│   ├── documents/          # Document uploads
│   ├── referrals/          # Patient referrals
│   ├── operations/         # Operations & activities
│   └── core/               # Departments, roles, capabilities
└── hospital_db.sqlite3     # SQLite database (gitignored)
```

## API Endpoints

### Authentication
- `POST /api/login/` — JWT login
- `POST /api/register/` — Register new user
- `GET /api/capabilities/` — Current user capabilities
- `GET /api/role-permissions/?role_id=DOCTOR` — Role capabilities
- `GET /api/health/` — Health check

### React Frontend
All endpoints under `/api/v1/` — see root README.md for full list.

### Legacy Frontend
All endpoints under `/api/` — compatibility layer for old vanilla JS frontend.

## Roles & Test Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | ADMIN |
| `admin2` | `password123` | ADMIN |
| `doctor1` | `password123` | DOCTOR |
| `chemist1` | `password123` | CHEMIST |
| `store_manager1` | `password123` | STORE_MANAGER |
| `qa1` | `password123` | QUALITY_ASSURANCE |
| `triage1` | `password123` | TRIAGE |
| `nurse1` | `password123` | NURSE |
| `receptionist1` | `password123` | RECEPTIONIST |
| `accountant1` | `password123` | ACCOUNTANT |
| `labtech1` | `password123` | LAB_TECH |

## RBAC Testing

```bash
# Login as doctor
curl -X POST http://localhost:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"doctor1","password":"password123"}'

# Use the returned token to access protected endpoints
curl http://localhost:8000/api/v1/patients/ \
  -H "Authorization: Bearer <token>"
```

## Management Commands

- `python manage.py create_test_users` — Create test users for all 10 roles
