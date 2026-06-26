# ModuCare MS — System Architecture

## Overview
ModuCare MS is a modular healthcare management system built as a static SPA with a Node.js HTTP API backend.

## System Architecture

### Frontend
- **Framework:** Vanilla JavaScript ES Modules (no build step)
- **Routing:** Client-side router (`src/js/router.js`) loading feature modules dynamically
- **State:** Observable global state (`src/js/state.js`)
- **Authentication:** JWT tokens stored in sessionStorage/localStorage
- **Layout:** Responsive admin template with hidden app shell for auth pages

### Backend
- **Server:** Node.js native HTTP server (`server/static-server.js`)
- **Database:** SQLite (`src/data/hospital.db`)
- **Auth:** JWT tokens (8h expiry) with bcrypt password hashing
- **RBAC:** Role-based access control (staff, lead, supervisor, director, admin)

### File Structure
```
├── index.html              # Main app shell
├── login.html              # Auth page
├── js/
│   ├── auth.js            # Auth module (session, loginRequest, RBAC)
│   ├── login.js           # Login page controller
│   ├── utils.js           # Shared utilities (API fetch, toast, formatters)
│   └── app.js
├── server/
│   ├── static-server.js   # Main HTTP server
│   ├── migrate.js         # DB schema + seed data
│   ├── config/db.js       # SQLite connection
│   ├── utils/jwt.js       # JWT signing/verification
│   └── controllers/       # API endpoint handlers
└── src/
    ├── features/          # Modular feature components
    └── js/             # Router, state, sidebar utilities
```

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| users | User credentials (id, email, passwordHash) |
| employees | Employee profiles (name, user_id, role_id) |
| roles | Role definitions (id, name, department_id) |
| patients | Patient records |
| encounters | Clinical encounters |
| appointments | Appointment scheduling |
| finance | Billing/payment records |
| operations | Task management |
| inventory | Stock tracking |
| notifications | Alert system |
| documents | Patient documents |
| referrals | Patient referrals |
| audit | Activity logging |
| incidents | Incident reporting |
| lab_orders | Lab test orders |
| pharmacy_dispensing | Medication dispensing |

### Role Hierarchy
```
staff (1) < lead (2) < supervisor (3) < director (4) < admin (5)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/login | No | Authenticate user |
| POST | /api/register | No | Register new user |
| GET | /api/users | admin | List users |
| GET | /api/patients | staff | List patients |
| POST | /api/patients | staff | Create patient |
| GET | /api/appointments | staff | List appointments |
| GET | /api/encounters | staff | List encounters |
| GET | /api/lab-orders | staff | List lab orders |
| GET | /api/pharmacy | staff | List medications |
| GET | /api/finance | lead | List billing records |
| GET | /api/operations | lead | List tasks |
| GET | /api/inventory | staff | List inventory |
| GET | /api/notifications | staff | List alerts |
| GET | /api/documents | staff | List documents |
| GET | /api/referrals | staff | List referrals |
| GET | /api/audit | staff | List audit logs |
| GET | /api/activities | staff | List activities |
| GET | /api/analytics | staff | Analytics data |
| GET | /api/incidents | staff | Incident reports |

## Production Gaps

### Critical
- [ ] Environment variables for secrets (JWT_SECRET)
- [ ] Input validation on all endpoints
- [ ] Error handling consistency
- [ ] Rate limiting restoration

### High Priority
- [ ] HTTPS enforcement
- [ ] Security headers (CSP, HSTS)
- [ ] Database connection pooling
- [ ] Request logging/middleware

### Medium Priority
- [ ] Input sanitization audit
- [ ] API response pagination
- [ ] Caching strategy
- [ ] Health check improvements

### Low Priority
- [ ] Build process (minification)
- [ ] Asset optimization
- [ ] Bundle analysis
- [ ] Performance monitoring

## Development Commands

```bash
npm start          # Start server on port 8081
node server/migrate.js  # Re-run database migration
```

## Credentials (Dev Only)
- Admin: `alice@acme.org` / `admin123`
- Staff: `danreech@acme.org` / `dan123`