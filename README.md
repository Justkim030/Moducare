# ModuCare MS

> **A centralized organizational management system** for HR, Operations, Finance, Analytics, Compliance, and beyond — built with a Vanilla Web Stack (HTML5 · CSS3 · ES6 Modules).

## ⚡ Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open **http://localhost:8081**

---

## 🗂 Current Project Structure

```
├── index.html                  # App shell (sidebar + header + router outlet)
├── login.html                  # Standalone sign-in page
├── forgot-password.html        # Password reset page
├── register.html               # User registration page
│
├── /server
│   ├── static-server.js        # Node HTTP server + REST API
│   └── /controllers
│       ├── authController.js   # Login / register (bcrypt)
│       ├── usersController.js  # User CRUD
│       ├── patientsController.js # Patient CRUD
│       ├── appointmentsController.js # Appointment CRUD
│       ├── incidentController.js     # Incident CRUD
│       └── financeController.js      # Finance/ledger CRUD
│
├── /css
│   ├── design-system.css       # CSS tokens, reset, typography
│   ├── components.css          # Shared UI components
│   ├── auth.css                # Login / auth pages
│   └── dashboard.css           # App shell layout
│
├── /js
│   ├── auth.js                 # Session management, role profiles, dashboard config
│   ├── login.js                # Login page controller
│   ├── app.js                  # Dashboard bootstrap
│   ├── router.js               # SPA router with RBAC guards
│   ├── sidebar.js              # Sidebar toggle / navigation
│   ├── store.js                # Reactive global state
│   └── utils.js                # Toast, date, CSV, API helpers
│
└── /src
    ├── /css/main.css           # Global app styles
    ├── /data/hospital.db       # SQLite seed database
    └── /features                # Department modules (isolated)
        ├── /dashboard          # Role-based KPI dashboard
        ├── /admin              # Admin user management (CRUD)
        ├── /patients           # Patient management (CRUD)
        ├── /staff              # Staff directory, search, export
        ├── /operations         # Kanban board + task tracking
        ├── /finance-billing    # Timesheet engine, billing log, rates
        ├── /incident-reporting # Incident submission & tracking
        ├── /communications     # Messaging (scaffold)
        ├── /scheduling-calendar # Calendar (scaffold)
        └── /analytics-reports  # Analytics (scaffold)
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- Modern browser with ES6 module support

### Installation
```bash
npm install
npm start
```

---

## 🔐 Authentication & Roles

- **Auth:** Email + password via `/api/login`
- **Hashing:** bcrypt (12 rounds)
- **Session:** JWT tokens with 8h expiry, stored in `sessionStorage` / `localStorage`
- **Security:** JWT verification on all protected API endpoints

### Role Levels

| Role | Level | Module Access |
|------|-------|---------------|
| `staff` | 1 | Dashboard, Operations, Scheduling, Communications, Incident Reporting |
| `lead` | 2 | + Staff, Finance, Patients, Document Vault, Client Portal |
| `supervisor` | 3 | + Analytics, Audit & Compliance |
| `director` | 4 | + Integrations |
| `admin` | 5 | + Admin (User Management), System Admin |

Each login renders a dashboard tailored to the user's role via `DASHBOARD_PROFILES` in `js/auth.js`.

---

## 🧩 Architecture

### App Shell
`index.html` is persistent. Sidebar, header, and footer stay mounted. Content is swapped in `#app-content`.

### Router
Client-side router (`src/js/router.js`) loads modules dynamically:
```js
import(`/src/features/${name}/index.js`)
```
Every module is protected by a **role gate** before mount.

### Feature Contract
Modules export `init(container, State)` and may return a `destroy()` lifecycle hook.

---

## 🔧 REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register` | Create user + employee profile |
| `POST` | `/api/login` | Authenticate, return session object |
| `GET` | `/api/health` | Health check |
| `GET/POST/PUT/DELETE` | `/api/users` | User CRUD |
| `GET/POST/PUT/DELETE` | `/api/patients` | Patient CRUD |
| `GET/POST/PUT/DELETE` | `/api/appointments` | Appointment CRUD |
| `GET/POST/PUT/DELETE` | `/api/incidents` | Incident CRUD |
| `GET/POST/PUT/DELETE` | `/api/finance` | Finance/ledger CRUD |

All endpoints return JSON. Server headers enforce `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

---

## 📦 Implemented Modules

### ✅ Dashboard (`/dashboard`)
- Role-adaptive KPI cards from `DASHBOARD_PROFILES`
- Per-role metrics and quick actions

### ✅ Admin — User Management (`/admin`)
- Full user CRUD via modal-driven UI
- Role assignment and password reset
- Server-backed `/api/users`

### ✅ Patients (`/patients`)
- Patient list with search/create/edit/delete
- Server-backed `/api/patients`

### ✅ Staff (`/staff`)
- Staff directory with grid/list views, search, filters
- Department and role badges
- CSV export

### ✅ Operations (`/operations`)
- Kanban board (Referred → Pending → Active → Completed)
- List view with sortable columns
- New task modal with priority, assignee, due date
- Overdue detection

### ✅ Finance & Billing (`/finance-billing`)
- Timesheet entry with live billing preview
- Automatic 15-minute unit conversion
- Billing log table with hours, units, amounts
- Rate management schedule
- CSV export

### ✅ Incident Reporting (`/incident-reporting`)
- Incident list with severity/status filters
- Create/edit/delete incidents
- Server-backed `/api/incidents`

---

## 🔲 Scaffolded Modules (ready for implementation)

| Module | Route | Suggested Priority |
|--------|-------|-------------------|
| Communications | `/communications` | Medium |
| Scheduling & Calendar | `/scheduling-calendar` | High |
| Analytics & Reports | `/analytics` | High |
| Audit & Compliance | `/audit-compliance` | High |

---

## 🎨 Design System

Tokens live in `/css/design-system.css`:
```css
/* Colors */   --clr-primary-500, --clr-accent-400, --clr-success, --clr-danger
/* Surfaces */ --surface-card, --surface-page, --surface-sidebar
/* Text */     --text-primary, --text-secondary, --text-tertiary
/* Spacing */  --sp-1 (4px) → --sp-16 (64px)
```

---

## 🛠 Developer Tools

**Secret Admin Login:**
- Navigate to `/secret-login` or use shortcuts (`Ctrl+Alt+L`)

**Database Reset:**
```bash
node server/migrate.js
```
> Drops and recreates all tables. Seed data is re-inserted.

---

## 📋 Conventions

- **No frameworks** — Vanilla HTML5, CSS3, ES6 Modules
- **Scoped styles** — each module loads its own CSS
- **Design tokens** — use CSS variables, avoid raw hex values
- **Module isolation** — no cross-feature imports
- **Shared code** — `/js/utils.js` or `/js/store.js`
- **API-first** — replace mock arrays with `fetch()` calls to the server controllers

---

## ✅ What to Work on Next

1. **Replace mock data with API calls**
    - `src/features/staff/` still uses `MOCK_STAFF` → connect to `/api/users`
    - `src/features/operations/` still uses `TASKS` → connect to `/api/operations`
    - `src/features/incident-reporting/` → connect to `/api/incidents`
    - `src/features/finance-billing/` still uses `TIMESHEETS` → connect to `/api/finance`

2. **Security hardening** (complete)
    - JWT verification on all protected server routes ✓
    - Request validation middleware active ✓

3. **Database performance**
    - Added indexes on frequently queried columns (patients.name, appointments.date, etc.)
    - Run `node server/migrate.js` to rebuild indexed database

4. **Scaffolded modules**
   - Communications (messaging UI + backend)
   - Scheduling & Calendar (event CRUD + `/api/appointments` expansion)
   - Analytics & Reports (data aggregation from existing APIs)

---

## 📝 Recent Fixes (2026-07-05)

- Fixed duplicate `/api/notifications` route in static-server.js
- Fixed undefined variables in patientsController.js handleCreate
- Fixed invalid SQLite UPDATE JOIN syntax in usersController.js
- Added missing analytics table to migration
- Fixed setSession arguments order in register.js
- Removed non-existent initRouter import in app.js
- Fixed syntax error in timeAgo function in utils.js
- Fixed nested db.serialize structure in migrate.js
- Added handleGet export to inventoryController.js

*ModuCare MS · Built with Vanilla Web Stack · &copy; 2025*
