# ModuCare MS — System Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [ERD Diagram](#erd-diagram)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Authentication & Authorization](#authentication--authorization)
7. [Frontend Modules](#frontend-modules)
8. [Production Deployment](#production-deployment)
9. [Development Commands](#development-commands)

---

## Overview

ModuCare MS is a modular healthcare management system designed for AMPATH clinic operations. It follows a **client-server architecture** with:

- **Frontend:** Static SPA using vanilla JavaScript ES modules
- **Backend:** Node.js HTTP server with SQLite database
- **Deployment:** Single server hosting both API and static assets

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│  login.html  →  js/login.js  →  /api/login  →  Auth Response    │
│       ↓                                                    │
│  index.html → router.js → Feature Modules → /api/* Endpoints       │
│       ↓                                                    │
│  State Management (user session, RBAC)                            │
├─────────────────────────────────────────────────────────────────┤
│                     Network Layer (HTTP)                         │
├─────────────────────────────────────────────────────────────────┤
│                server/static-server.js (Node.js)                  │
│  - Request Routing                                              │
│  - JWT Verification                                             │
│  - Rate Limiting                                                │
│  - File Serving                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    Data Layer (SQLite)                           │
│  src/data/hospital.db - Single file database                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ERD Diagram

```text
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │──────▶│  employees   │──────▶│   roles     │
│─────────────│       │─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ email       │◀──────│ user_id (FK)│       │ name        │
│ passwordHash│       │ name        │       │ dept_id (FK)│
│ phone       │       │ role_id (FK)│       └─────────────┘
└─────────────┘       └─────────────┘             ▲
                                                 │
┌─────────────┐       ┌─────────────┐             │
│  patients   │       │ appointments│             │
│─────────────│       │─────────────│             │
│ id (PK)     │       │ id (PK)     │
│ name        │       │ patient_id  │
│ dob         │       │ employee_id │◀────────────┘
│ phone       │       │ time        │
└─────────────┘       └─────────────┘
       ▲                   ▲
       │                   │
┌─────────────┐       ┌─────────────┐
│ encounters  │       │    finance  │
│─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)     │
│ patient_id  │       │ type        │
│ provider_id │       │ reference   │
│ date        │       │ amount      │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│ lab_orders  │       │ pharmacy_   │
│─────────────│       │ dispensing  │
│ id (PK)     │       │─────────────│
│ patient_id  │       │ id (PK)     │
│ encounter_id│       │ encounter_id│
│ test_type   │       │ drug_name   │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│ documents   │       │ inventory   │
│─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)     │
│ patient_id  │       │ name        │
│ doc_type    │       │ stock       │
│ file_name   │       │ supplier    │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│  audit      │       │incidents    │
│─────────────│       │─────────────│
│ id (PK)     │       │ id (PK)     │
│ user_id     │       │ created     │
│ action      │       │ severity    │
│ timestamp   │       │ status      │
└─────────────┘       └─────────────┘
```

---

## Database Schema

### users

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Unique user identifier |
| email | TEXT UNIQUE | User email |
| phone_number | TEXT | Contact number |
| passwordHash | TEXT | bcrypt hashed password |

### employees

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Employee identifier |
| name | TEXT | Full name |
| user_id | TEXT (FK) | References users.id |
| role_id | TEXT (FK) | References roles.id |

### roles

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Role identifier (role_admin, role_dev, etc.) |
| name | TEXT | Display name |
| department_id | TEXT (FK) | References departments.id |

### patients

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Patient ID (pat_*) |
| name | TEXT | Full name |
| email | TEXT | Contact email |
| phone_number | TEXT | Phone |
| dob | TEXT | Date of birth |
| gender | TEXT | Gender |
| hiv_status | TEXT | HIV status |

### encounters

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| patient_id | TEXT (FK) | References patients.id |
| encounter_date | TEXT | Visit date |
| visit_type | TEXT | Consultation type |
| provider_id | TEXT (FK) | References employees.id |
| chief_complaint | TEXT | Initial complaint |

### appointments

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| time | TEXT | Appointment datetime |
| patient_id | TEXT (FK) | References patients.id |
| employee_id | TEXT (FK) | References employees.id |
| type | TEXT | Appointment type |
| status | TEXT | Scheduled/Completed |

### finance

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| type | TEXT | Invoice/Payment/etc |
| reference | TEXT | Reference number |
| amount | REAL | Amount (KSh) |
| status | TEXT | Paid/Pending |

### operations

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| title | TEXT | Task title |
| department | TEXT | Department |
| priority | TEXT | Low/Medium/High/Urgent |
| status | TEXT | Active/Completed |
| employee_id | TEXT (FK) | Assignee |

---

## API Endpoints

### Authentication

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/login` | - | Returns JWT token |
| POST | `/api/register` | - | Creates new user |

### Users

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/users` | admin | List all users |
| POST | `/api/users` | admin | Create user |
| PUT | `/api/users/{id}` | admin | Update user |
| DELETE | `/api/users/{id}` | admin | Delete user |

### Patients

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/patients` | staff | List patients |
| GET | `/api/patients/{id}` | staff | Get patient |
| POST | `/api/patients` | staff | Create patient |
| PUT | `/api/patients/{id}` | staff | Update patient |
| DELETE | `/api/patients/{id}` | staff | Delete patient |

### Clinical Modules

| Endpoint | Role | Description |
|----------|------|-------------|
| `/api/encounters` | staff | Encounter records |
| `/api/lab-orders` | staff | Laboratory orders |
| `/api/pharmacy` | staff | Medication dispensing |
| `/api/appointments` | staff | Appointment scheduling |
| `/api/incidents` | staff | Incident reporting |

### Administrative

| Endpoint | Role | Description |
|----------|------|-------------|
| `/api/finance` | lead | Billing records |
| `/api/operations` | lead | Task management |
| `/api/inventory` | staff | Stock levels |
| `/api/notifications` | staff | Alerts |
| `/api/documents` | staff | Patient documents |
| `/api/referrals` | staff | Referrals |
| `/api/audit` | staff | Activity logs |
| `/api/activities` | staff | Operations activities |
| `/api/analytics` | staff | Reports data |

---

## Authentication & Authorization

### JWT Token Claims

```json
{
  "id": "usr_*",
  "employee_id": "emp_*",
  "name": "Full Name",
  "email": "user@org.org",
  "phone_number": "+254...",
  "role_id": "role_staff",
  "iat": 1782382267,
  "exp": 1782411067
}
```

### Role Levels

| Role | Level | Grants Access To |
|------|-------|----------------|
| staff | 1 | Patients, Encounters, Lab, Pharmacy |
| lead | 2 | Finance-Billing, Communications |
| supervisor | 3 | Audit-Compliance, Analytics |
| director | 4 | Integrations |
| admin | 5 | System-Admin, Users |

---

## Frontend Modules

| Module | Path | Protected Route |
|--------|------|----------------|
| Dashboard | `/dashboard` | staff |
| Staff | `/staff` | admin |
| Patients | `/patients` | staff |
| Encounters | `/encounters` | staff |
| Lab Orders | `/lab-orders` | staff |
| Pharmacy | `/pharmacy` | staff |
| Appointments | `/appointments` | staff |
| Finance | `/finance-billing` | lead |
| Operations | `/operations` | lead |
| Communications | `/communications` | staff |
| Audit | `/audit-compliance` | supervisor |
| Notifications | `/notifications` | staff |
| Documents | `/documents` | lead |
| Inventory | `/inventory` | staff |
| Analytics | `/analytics-reports` | supervisor |
| Admin | `/admin` | admin |
| Incidents | `/incident-reporting` | staff |

---

## Production Deployment

### Environment Variables (.env)

```text
PORT=8081
DATABASE_URL=sqlite://src/data/hospital.db
JWT_SECRET=<generate-secure-secret>
```

### Security Checklist

- [x] Password hashing (bcrypt)
- [x] JWT authentication
- [x] RBAC enforcement
- [x] Rate limiting on login endpoint
- [x] XSS prevention (escapeHTML)
- [ ] HTTPS (use reverse proxy)
- [ ] CSP headers
- [ ] Input validation (zod/Joi)

---

## Development Commands

```bash
# Start server
npm start

# Re-run database migration
node server/migrate.js

# Test API
curl -X POST http://localhost:8081/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@acme.org","password":"admin123"}'
```

## Default Credentials (Dev)

- Admin: `alice@acme.org` / `admin123`
- Staff: `danreech@acme.org` / `dan123`