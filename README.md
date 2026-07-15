# ModuCare MS

> **A centralized organizational management system** for HR, Operations, Finance, Analytics, Compliance, and beyond — built with Django REST Framework.

## ⚡ Quick Start (Local Development)

1. Create a virtual environment and activate it:
    ```bash
    python -m venv .venv
    .venv\Scripts\activate   # Windows
    source .venv/bin/activate  # Linux/Mac
    ```

2. Install dependencies:
    ```bash
    pip install -r backend/requirements.txt
    ```

3. Run migrations:
    ```bash
    cd backend
    python manage.py migrate
    ```

4. (Optional) Create test users for all roles:
    ```bash
    python manage.py create_test_users
    ```

5. Start the server:
    ```bash
    python manage.py runserver 8000
    ```

6. Open **http://localhost:8000**

---
## 🔐 Default Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | ADMIN (superuser) |
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

---
## 🔐 Authentication & RBAC

- **Auth:** JWT via `/api/login/` and `/api/register/`
- **Token lifetime:** 8 hours
- **Permissions:** Role-Based Access Control (RBAC) with capability engine
- **Default permission class:** `IsAuthenticated` on all endpoints

### Role Capabilities

| Role | Capabilities | Modules |
|------|--------------|---------|
| ADMIN | All capabilities | All modules |
| DOCTOR | patient:read, patient:write_clinical, encounter:read, encounter:write, prescription:write, lab:order, lab:read, referral:write, appointment:read, communication:read, communication:write | dashboard, patients, communications, scheduling-calendar, documents, encounters, lab-orders |
| CHEMIST | dashboard:view, patient:read, pharmacy:dispense, pharmacy:inventory_read, lab:read, communication:read | dashboard, patients, communications, documents, lab-orders, pharmacy |
| STORE_MANAGER | dashboard:view, inventory:read, inventory:write, inventory:approve, communication:read | dashboard, communications, inventory |
| QUALITY_ASSURANCE | dashboard:view, incident:read, audit:read, analytics:read, report:export, communication:read | dashboard, communications, audit-compliance, incident-reporting, analytics-reports |
| TRIAGE | dashboard:view, patient:read, patient:write_vitals, encounter:read, appointment:read, communication:read | dashboard, patients, communications, scheduling-calendar, documents, encounters |
| NURSE | dashboard:view, patient:read, patient:write_vitals, encounter:read, appointment:read, communication:read | dashboard, patients, communications, scheduling-calendar, documents, encounters |
| RECEPTIONIST | dashboard:view, patient:read, patient:register, appointment:read, appointment:write, communication:read | dashboard, patients, communications, scheduling-calendar, documents |
| ACCOUNTANT | dashboard:view, patient:read, finance:read, finance:write, report:export, communication:read | dashboard, patients, finance-billing, communications, documents |
| LAB_TECH | dashboard:view, lab:read, lab:result_entry, communication:read | dashboard, communications, lab-orders |

---
## 🗂 Project Structure

```
Moducare/
├── backend/                    # Django backend
│   ├── manage.py               # Django CLI entry point
│   ├── backend/                # Django project package (settings, urls, wsgi, asgi)
│   ├── apps/                   # 19 Django apps
│   │   ├── users/              # Authentication, roles, employees
│   │   ├── patients/           # Patient records
│   │   ├── visits/             # Visits, triage, ward logs
│   │   ├── prescriptions/      # Prescriptions & items
│   │   ├── lab/                # Lab tests & requests
│   │   ├── inventory/          # Medicines & stock
│   │   ├── appointments/       # Appointments
│   │   ├── accounts/           # Invoices & payments
│   │   ├── finance/            # Finance transactions
│   │   ├── hr/                 # HR: staff, contracts, payroll, attendance, leave
│   │   ├── analytics/          # Analytics metrics
│   │   ├── reports/            # Reports
│   │   ├── audit/              # Audit logs
│   │   ├── communications/     # Notifications
│   │   ├── documents/          # Document uploads
│   │   ├── referrals/          # Patient referrals
│   │   ├── operations/         # Operations & activities
│   │   └── core/               # Departments, roles, capabilities
│   └── hospital_db.sqlite3     # SQLite database
├── frontend/                   # React frontend (collaborator)
├── src/                        # Old vanilla JS SPA (preserved)
├── js/                         # Old JS modules (preserved)
├── css/                        # Old CSS (preserved)
└── README.md                   # This file
```

> **Note:** The Django project package lives at `backend/backend/` — this is standard Django layout. `backend/manage.py` sets `DJANGO_SETTINGS_MODULE=backend.settings`, which resolves to `backend/backend/settings.py`.

---
## 🚀 REST API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login/` | JWT login (returns token + user + capabilities + modules) |
| `POST` | `/api/register/` | Register new user |
| `GET` | `/api/capabilities/` | Current user capabilities |
| `GET` | `/api/role-permissions/` | Get capabilities for a role (`?role_id=DOCTOR`) |
| `GET` | `/api/health/` | Health check |

### React Frontend API (`/api/v1/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/v1/users/` | Users |
| `GET/POST` | `/api/v1/patients/` | Patients |
| `GET/POST` | `/api/v1/prescriptions/` | Prescriptions |
| `GET/POST` | `/api/v1/visits/` | Visits |
| `GET/POST` | `/api/v1/lab/` | Lab tests |
| `GET/POST` | `/api/v1/accounts/invoices/` | Invoices |
| `GET/POST` | `/api/v1/accounts/payments/` | Payments |
| `GET/POST` | `/api/v1/appointments/` | Appointments |
| `GET/POST` | `/api/v1/finance/` | Finance |
| `GET/POST` | `/api/v1/hr/staff/` | HR Staff |
| `GET/POST` | `/api/v1/hr/profiles/` | Employee Profiles |
| `GET/POST` | `/api/v1/hr/contracts/` | Contracts |
| `GET/POST` | `/api/v1/hr/trainings/` | Training Records |
| `GET/POST` | `/api/v1/hr/performance/` | Performance Reviews |
| `GET/POST` | `/api/v1/hr/payroll/` | Payroll |
| `GET/POST` | `/api/v1/hr/attendance/` | Attendance |
| `GET/POST` | `/api/v1/hr/leave/` | Leave Requests |
| `GET/POST` | `/api/v1/analytics/` | Analytics |
| `GET/POST` | `/api/v1/reports/` | Reports |
| `GET/POST` | `/api/v1/audit/` | Audit logs |
| `GET/POST` | `/api/v1/notifications/` | Notifications |
| `GET/POST` | `/api/v1/documents/` | Documents |
| `GET/POST` | `/api/v1/referrals/` | Referrals |
| `GET/POST` | `/api/v1/operations/` | Operations |

### Legacy Frontend Compatibility (`/api/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/users/` | Users |
| `GET/POST` | `/api/employees/` | Employees |
| `GET/POST` | `/api/patients/` | Patients |
| `GET/POST` | `/api/incidents/` | Incident Reports |
| `GET/POST` | `/api/inventory/` | Medicines |
| `GET/POST` | `/api/operations/` | Operations |
| `GET/POST` | `/api/finance/` | Finance |
| `GET/POST` | `/api/appointments/` | Appointments |
| `GET/POST` | `/api/staff/` | HR Staff |
| `GET/POST` | `/api/profiles/` | Employee Profiles |
| `GET/POST` | `/api/contracts/` | Contracts |
| `GET/POST` | `/api/trainings/` | Training Records |
| `GET/POST` | `/api/performance/` | Performance Reviews |
| `GET/POST` | `/api/payroll/` | Payroll |
| `GET/POST` | `/api/attendance/` | Attendance |
| `GET/POST` | `/api/leave/` | Leave Requests |
| `GET/POST` | `/api/analytics/` | Analytics |
| `GET/POST` | `/api/reports/` | Reports |
| `GET/POST` | `/api/audit/` | Audit logs |
| `GET/POST` | `/api/notifications/` | Notifications |
| `GET/POST` | `/api/documents/` | Documents |
| `GET/POST` | `/api/referrals/` | Referrals |

---
## 🛠 Developer Commands

```bash
# Run server
python manage.py runserver 8000

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create test users
python manage.py create_test_users

# Open Django shell
python manage.py shell
```

---
## ✅ What to Work on Next

1. **Connect React frontend** to `/api/v1/` endpoints
2. **Connect old vanilla JS frontend** to `/api/` compatibility endpoints
3. **Implement dashboard rendering** per role using capabilities/modules from login response
4. **Add pagination** and filtering on all list endpoints
5. **Add file upload** for documents and profile pictures
6. **Add email notifications** for appointments and referrals
7. **Add reporting** with PDF export

---
## 📝 Recent Changes (2026-07-15)

- Migrated from Node.js to Django REST Framework
- Implemented 19 Django apps with full REST API surface
- JWT authentication with role-based capabilities engine
- Database indexes added to all ForeignKey and filtered fields
- Fixed duplicate model collision (`hr.Employee` → `hr.Staff`)
- Fixed routing conflicts in HR module
- Added missing API routes for all modules
- Added test user creation command
- Verified all endpoints return 200 OK

*ModuCare MS · Built with Django REST Framework · &copy; 2025*
