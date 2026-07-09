/**
 * ModuCare MS — Auth Module
 * Handles: session storage, auth guards, role checking, token management
 * Imported by: login.js, app.js, and any protected module
 */

import { getUserClass, isFeatureAllowed, routeToFeatureId } from './access-classes.js';

// ── Constants ────────────────────────────────────────────────
const SESSION_KEY   = 'moducare_session';
const REMEMBER_KEY  = 'moducare_remember';

// Role hierarchy (higher index = more permissions)
export const ROLES = {
  STAFF:      { id: 'staff',      label: 'Staff',        level: 1, color: '#5B9ED6' },
  LEAD:       { id: 'lead',       label: 'Team Lead',    level: 2, color: '#13C8BC' },
  SUPERVISOR: { id: 'supervisor', label: 'Supervisor',   level: 3, color: '#F59E0B' },
  DIRECTOR:   { id: 'director',   label: 'Director',     level: 4, color: '#1E5799' },
  ADMIN:      { id: 'admin',      label: 'System Admin', level: 5, color: '#DC2626' },
};

// Module → minimum role level required
export const MODULE_PERMISSIONS = {
  'dashboard':          1,
  'hr-staff':           2,
  'operations':         1,
  'finance-billing':    2,
  'analytics-reports':  3,
  'scheduling-calendar':1,
  'communications':     1,
  'notifications':      1,
  'documents':          2,
  'audit-compliance':   3,
  'client-portal':      2,
  'integrations':       4,
  'system-admin':       5,
  'patients':           1,
};

// Department-based card filtering (keyed by department ID from DB)
export const DEPARTMENT_MODULES = {
  'dept_tech': ['operations', 'communications', 'documents', 'patients'],
  'dept_clin': ['patients', 'scheduling-calendar', 'operations', 'communications', 'notifications', 'encounters'],
  'dept_admin': ['finance-billing', 'patients', 'notifications', 'audit-compliance', 'documents'],
};

// ── Clinical RBAC (Level 1 + Level 2) ──────────────────────────
// Maps the DB role_id to a clinical workspace profile. The backend is the
// authoritative source of capabilities; the frontend only renders what the
// server returns in the login payload (session.capabilities).
export const CLINICAL_ROLE_MAP = {
  role_admin:      { key: 'admin',    label: 'System Admin',          color: '#DC2626' },
  role_dev:        { key: 'intake',   label: 'Front-Desk / Intake',   color: '#5B9ED6' },
  role_nurse:      { key: 'triage',   label: 'Clinical Staff / Triage', color: '#13C8BC' },
  role_lead:       { key: 'provider', label: 'Healthcare Provider',   color: '#1E5799' },
  role_supervisor: { key: 'mande',    label: 'Facility Analytics & M&E', color: '#F59E0B' },
  role_director:   { key: 'mande',    label: 'Facility Analytics & M&E', color: '#F59E0B' },
  role_finance:    { key: 'ancillary',label: 'Ancillary Services',    color: '#7C3AED' },
};

// module id -> capability required to view it (mirrors server MODULE_CAPABILITIES)
export const MODULE_CAPABILITIES = {
  'dashboard':           'dashboard:view',
  'patients':            'patient:read',
  'staff':               'staff:read',
  'finance-billing':     'finance:read',
  'operations':          'operations:read',
  'clinical':            'clinical:read',
  'communications':      'communication:read',
  'audit-compliance':    'audit:read',
  'incident-reporting':  'incident:read',
  'scheduling-calendar': 'appointment:read',
  'documents':           'patient:read',
  'encounters':          'encounter:read',
  'lab-orders':          'lab:read',
  'pharmacy':            'pharmacy:inventory_read',
  'analytics-reports':   'analytics:read',
  'admin':               'user:manage',
  'inventory':           'inventory:read',
  'time-attendance':     'attendance:view',
  'leave':               'leave:create',
  'system-health':       'system:health',
};

// Clinical dashboard blueprint (6 cards per role) — rendered only if the
// user holds the required capability (Level 1).
export const CLINICAL_PROFILES = {
  admin: {
    title: 'System Administration',
    description: 'User management, system health, audit logs, and access control.',
    cards: [
      { id: 'user-provisioning', title: 'User Provisioning', route: '/admin', icon: '👤', cap: 'user:manage', data: 'users' },
      { id: 'role-permissions',  title: 'Role Permissions',  route: '/admin', icon: '🔐', cap: 'role:manage' },
      { id: 'audit-logs',        title: 'Audit Logs',        route: '/audit-compliance', icon: '📝', cap: 'audit:read', data: 'audit' },
      { id: 'system-health',     title: 'System Health',     route: '/dashboard/overview', icon: '🖥️', cap: 'system:health' },
      { id: 'db-backups',        title: 'Database Backups',  route: '/admin', icon: '💾', cap: 'backup:manage' },
      { id: 'incident-logs',     title: 'Incident Logs',     route: '/incident-reporting', icon: '🚨', cap: 'incident:read', data: 'incidents' },
    ],
  },
  intake: {
    title: 'Front-Desk / Intake',
    description: 'Get patients into the building and route them correctly.',
    cards: [
      { id: 'patient-search',   title: 'Patient Search',     route: '/patients/list', icon: '🔎', cap: 'patient:read' },
      { id: 'new-registration', title: 'New Registration',   route: '/patients/new', icon: '📝', cap: 'patient:register' },
      { id: 'visit-initiation', title: 'Visit Initiation',   route: '/patients/new', icon: '🚪', cap: 'appointment:write' },
      { id: 'facility-queue',   title: 'Active Facility Queue', route: '/dashboard', icon: '📋', cap: 'patient:read' },
      { id: 'appointments',     title: 'Appointments Schedule', route: '/scheduling-calendar', icon: '📅', cap: 'appointment:read' },
      { id: 'demographics',     title: 'Demographics Update', route: '/patients/list', icon: '🏠', cap: 'patient:write_demographics' },
    ],
  },
  triage: {
    title: 'Clinical Staff / Triage',
    description: 'Capture initial vitals and clear the waitlist.',
    cards: [
      { id: 'triage-waitlist',  title: 'Triage Waitlist',   route: '/dashboard', icon: '⏳', cap: 'patient:read' },
      { id: 'vitals-capture',   title: 'Vitals Capture',    route: '/encounters', icon: '💓', cap: 'patient:write_vitals' },
      { id: 'encounter-history',title: 'Encounter History', route: '/encounters', icon: '📁', cap: 'encounter:read' },
      { id: 'screening-tools',  title: 'Screening Tools (TB/Nutrition)', route: '/encounters', icon: '🧪', cap: 'encounter:write' },
      { id: 'patient-handover', title: 'Patient Handover',  route: '/communications', icon: '🤝', cap: 'communication:write' },
      { id: 'incident-reporting', title: 'Incident Reporting', route: '/incident-reporting', icon: '🚨', cap: 'incident:write' },
    ],
  },
  provider: {
    title: 'Healthcare Provider',
    description: 'Clinical decision-making, examinations, and order entries.',
    cards: [
      { id: 'clinical-workspace', title: 'Clinical Workspace', route: '/encounters', icon: '🩺', cap: 'encounter:read' },
      { id: 'consultation-forms', title: 'Consultation Forms', route: '/encounters', icon: '📋', cap: 'encounter:write' },
      { id: 'order-entry',        title: 'Order Entry (Lab/Rx)', route: '/lab-orders', icon: '🧾', cap: 'prescription:write' },
      { id: 'care-timeline',      title: 'Patient Care Timeline', route: '/patients/records', icon: '🕒', cap: 'patient:read' },
      { id: 'referrals',          title: 'Referrals & Discharges', route: '/referrals', icon: '↪️', cap: 'referral:write' },
      { id: 'medical-alerts',     title: 'Medical Alerts / CDSS', route: '/dashboard', icon: '🔔', cap: 'patient:write_clinical' },
    ],
  },
  mande: {
    title: 'Facility Analytics & M&E',
    description: 'Aggregated reporting, compliance, and clinical outcomes.',
    cards: [
      { id: 'cohort-tracking', title: 'M&E Cohort Tracking', route: '/dashboard', icon: '📊', cap: 'analytics:read' },
      { id: 'moh-exports',     title: 'MoH Reporting Exports', route: '/dashboard', icon: '📤', cap: 'report:export' },
      { id: 'facility-kpis',   title: 'Facility Performance KPIs', route: '/dashboard/kpi-1', icon: '📈', cap: 'analytics:read' },
      { id: 'defaulter-logs',  title: 'Retention & Defaulter Logs', route: '/dashboard', icon: '📉', cap: 'analytics:read' },
      { id: 'quality-assurance', title: 'Quality Assurance (QA)', route: '/audit-compliance', icon: '✅', cap: 'audit:read' },
      { id: 'finance-summaries', title: 'Finance & Billing Summaries', route: '/finance-billing', icon: '💰', cap: 'finance:read' },
      { id: 'attendance-review', title: 'Attendance Review', route: '/time-attendance', icon: '⏰', cap: 'attendance:view' },
      { id: 'leave-approvals', title: 'Leave Approvals', route: '/leave', icon: '📅', cap: 'leave:approve' },
    ],
  },
  ancillary: {
    title: 'Ancillary Services',
    description: 'Fulfill clinical orders: lab results and pharmacy dispensing.',
    cards: [
      { id: 'pending-lab',    title: 'Pending Lab Orders', route: '/lab-orders', icon: '🧪', cap: 'lab:read' },
      { id: 'results-entry',  title: 'Results Entry',      route: '/lab-orders', icon: '📥', cap: 'lab:result_entry' },
      { id: 'prescription-q', title: 'Prescription Queue', route: '/pharmacy', icon: '💊', cap: 'pharmacy:dispense' },
      { id: 'drug-dispensing',title: 'Drug Dispensing',    route: '/pharmacy', icon: '💉', cap: 'pharmacy:dispense' },
      { id: 'pharma-inventory', title: 'Pharmaceutical Inventory', route: '/pharmacy', icon: '📦', cap: 'pharmacy:inventory_read' },
      { id: 'stock-alerts',   title: 'Stock Alerts',       route: '/inventory', icon: '⚠️', cap: 'inventory:read' },
    ],
  },
};

// Role-specific dashboard cards and quick actions
export const DASHBOARD_PROFILES = {
  staff: {
    title: 'My Workspace',
    description: 'Your daily tasks, appointments, and patient queue.',
    cards: [
      { id: 'my-tasks', title: 'My Tasks', route: '/dashboard/tasks', icon: '📋', data: 'tasks', module: 'operations' },
      { id: 'appointments', title: 'Appointments', route: '/scheduling-calendar', icon: '📅', data: 'appointments', module: 'scheduling-calendar' },
      { id: 'patients', title: 'My Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
      { id: 'incidents', title: 'Incident Reporting', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'communications', title: 'Communications', route: '/communications', icon: '💬', data: 'notifications', module: 'communications' },
      { id: 'documents', title: 'Document Vault', route: '/documents', icon: '📁', data: 'documents', module: 'documents' },
    ],
  },
  lead: {
    title: 'Team Lead Workspace',
    description: 'Team performance, scheduling, approvals, and reports.',
    cards: [
      { id: 'team-tasks', title: 'Team Tasks', route: '/dashboard/tasks', icon: '✅', data: 'teamTasks', module: 'operations' },
      { id: 'schedule', title: 'Schedule', route: '/scheduling-calendar', icon: '📅', data: 'appointments', module: 'scheduling-calendar' },
      { id: 'timesheets', title: 'Timesheets', route: '/finance-billing', icon: '⏱️', data: 'finance', module: 'finance-billing' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'communications', title: 'Communications', route: '/communications', icon: '💬', data: 'notifications', module: 'communications' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
  supervisor: {
    title: 'Supervisor Overview',
    description: 'Department oversight, compliance, and resource planning.',
    cards: [
      { id: 'compliance', title: 'Compliance', route: '/audit-compliance', icon: '🛡️', data: 'totalIncidents', module: 'audit-compliance' },
      { id: 'staffing', title: 'Staffing', route: '/staff', icon: '👥', data: 'staffCount', module: 'patients' },
      { id: 'operations', title: 'Operations', route: '/operations', icon: '⚙️', data: 'totalOperations', module: 'operations' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', data: 'finance', module: 'finance-billing' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
  director: {
    title: 'Director Dashboard',
    description: 'Hospital-wide KPIs, financials, staffing, and risk.',
    cards: [
      { id: 'kpi', title: 'KPIs', route: '/dashboard/kpi-1', icon: '📈', data: 'totalOperations', module: 'operations' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', data: 'finance', module: 'finance-billing' },
      { id: 'staffing', title: 'Staffing', route: '/staff', icon: '👥', data: 'staffCount', module: 'patients' },
      { id: 'incidents', title: 'Risk / Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'operations', title: 'Operations', route: '/operations', icon: '⚙️', data: 'totalOperations', module: 'operations' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
  admin: {
    title: 'System Administration',
    description: 'User management, system health, audit logs, and access control.',
    cards: [
      { id: 'users', title: 'Users', route: '/admin', icon: '👤', data: 'users', module: 'system-admin' },
      { id: 'audit', title: 'Audit Logs', route: '/audit-compliance', icon: '📝', data: 'audit', module: 'audit-compliance' },
      { id: 'health', title: 'System Health', route: '/dashboard/overview', icon: '🖥️', data: 'audit', module: 'operations' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', data: 'finance', module: 'finance-billing' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
};

export function getDashboardProfile(roleId, departmentId) {
  const clinical = CLINICAL_ROLE_MAP[(roleId || '').toLowerCase()];
  const profile = CLINICAL_PROFILES[clinical ? clinical.key : 'intake'] || CLINICAL_PROFILES.intake;
  const caps = getSession()?.capabilities || [];
  const allowed = (cap) => !cap || caps.includes(cap) || caps.includes('*');
  return {
    ...profile,
    cards: profile.cards.filter(card => allowed(card.cap)),
  };
}

export function canAccessCapability(capability) {
  const caps = getSession()?.capabilities || [];
  return caps.includes('*') || caps.includes(capability);
}

// ── Role-Aware Quick Actions ────────────────────────────────
// Dropdown "quick navigation" actions surfaced per signed-in user role.
// Each action navigates to a route and is gated by an optional capability so
// only activities the user is actually allowed to perform are shown.
export const QUICK_ACTIONS = {
  // ── Clinical workspaces (resolved via CLINICAL_ROLE_MAP) ──
  admin: [
    { label: 'Add User',            icon: '➕', route: '/admin',              cap: 'user:manage' },
    { label: 'Role Permissions',    icon: '🔐', route: '/admin',              cap: 'role:manage' },
    { label: 'View Audit Logs',     icon: '📝', route: '/audit-compliance',   cap: 'audit:read' },
    { label: 'System Health',       icon: '🖥️', route: '/dashboard/overview', cap: 'system:health' },
    { label: 'Manage Incidents',    icon: '🚨', route: '/incident-reporting', cap: 'incident:read' },
    { label: 'Finance Overview',    icon: '💰', route: '/finance-billing',    cap: 'finance:read' },
    { label: 'Staff Directory',     icon: '👥', route: '/staff',              cap: 'staff:read' },
  ],
  intake: [
    { label: 'Register Patient',    icon: '📝', route: '/patients',           cap: 'patient:register' },
    { label: 'Search Patients',     icon: '🔎', route: '/patients',           cap: 'patient:read' },
    { label: 'Schedule Appointment',icon: '📅', route: '/scheduling-calendar',cap: 'appointment:read' },
    { label: 'Active Facility Queue',icon:'📋', route: '/dashboard',          cap: 'patient:read' },
  ],
  triage: [
    { label: 'Capture Vitals',      icon: '💓', route: '/encounters',         cap: 'patient:write_vitals' },
    { label: 'Triage Waitlist',     icon: '⏳', route: '/dashboard',          cap: 'patient:read' },
    { label: 'Report Incident',     icon: '🚨', route: '/incident-reporting', cap: 'incident:write' },
    { label: 'Patient Handover',    icon: '🤝', route: '/communications',     cap: 'communication:write' },
  ],
  provider: [
    { label: 'Clinical Workspace',  icon: '🩺', route: '/encounters',         cap: 'encounter:read' },
    { label: 'Order Entry (Lab/Rx)',icon: '🧾', route: '/lab-orders',         cap: 'prescription:write' },
    { label: 'Referrals & Discharge',icon:'↪️', route: '/referrals',          cap: 'referral:write' },
    { label: 'Care Timeline',       icon: '🕒', route: '/patients',           cap: 'patient:read' },
  ],
  mande: [
    { label: 'M&E Cohort Tracking', icon: '📊', route: '/dashboard',          cap: 'analytics:read' },
    { label: 'MoH Reporting Export',icon: '📤', route: '/dashboard',          cap: 'report:export' },
    { label: 'Quality Assurance',   icon: '✅', route: '/audit-compliance',   cap: 'audit:read' },
    { label: 'Finance Summary',     icon: '💰', route: '/finance-billing',    cap: 'finance:read' },
  ],
  ancillary: [
    { label: 'Pending Lab Orders',  icon: '🧪', route: '/lab-orders',         cap: 'lab:read' },
    { label: 'Prescription Queue',  icon: '💊', route: '/pharmacy',           cap: 'pharmacy:dispense' },
    { label: 'Pharmacy Inventory',  icon: '📦', route: '/pharmacy',           cap: 'pharmacy:inventory_read' },
    { label: 'Stock Alerts',        icon: '⚠️', route: '/inventory',          cap: 'inventory:read' },
  ],
  // ── Legacy hierarchy roles (fallback) ──
  staff: [
    { label: 'My Tasks',            icon: '📋', route: '/dashboard/tasks',    cap: 'operations:read' },
    { label: 'Appointments',        icon: '📅', route: '/scheduling-calendar',cap: 'appointment:read' },
    { label: 'My Patients',         icon: '👥', route: '/patients',           cap: 'patient:read' },
    { label: 'Report Incident',     icon: '🚨', route: '/incident-reporting', cap: 'incident:write' },
  ],
  lead: [
    { label: 'Team Tasks',          icon: '✅', route: '/dashboard/tasks',    cap: 'operations:read' },
    { label: 'Timesheets',          icon: '⏱️', route: '/finance-billing',    cap: 'finance:read' },
    { label: 'Schedule',            icon: '📅', route: '/scheduling-calendar',cap: 'appointment:read' },
    { label: 'Patients',            icon: '👥', route: '/patients',           cap: 'patient:read' },
  ],
  supervisor: [
    { label: 'Compliance',          icon: '🛡️', route: '/audit-compliance',   cap: 'audit:read' },
    { label: 'Staffing',            icon: '👥', route: '/staff',              cap: 'staff:read' },
    { label: 'Operations',          icon: '⚙️', route: '/operations',         cap: 'operations:read' },
    { label: 'Finance',             icon: '💰', route: '/finance-billing',    cap: 'finance:read' },
    { label: 'Attendance Review',   icon: '⏰', route: '/time-attendance',    cap: 'attendance:view' },
    { label: 'Leave Approvals',     icon: '📅', route: '/leave',              cap: 'leave:approve' },
  ],
  director: [
    { label: 'Hospital KPIs',       icon: '📈', route: '/dashboard/kpi-1',    cap: 'analytics:read' },
    { label: 'Finance',             icon: '💰', route: '/finance-billing',    cap: 'finance:read' },
    { label: 'Staffing',            icon: '👥', route: '/staff',              cap: 'staff:read' },
    { label: 'Risk / Incidents',    icon: '🚨', route: '/incident-reporting', cap: 'incident:read' },
    { label: 'Inventory Audit',     icon: '📦', route: '/inventory',          cap: 'inventory:audit' },
    { label: 'Attendance Review',   icon: '⏰', route: '/time-attendance',    cap: 'attendance:view' },
  ],
};

/**
 * Resolves the quick-navigation actions for a signed-in user, filtered by the
 * capabilities present in their session (RBAC-aware). Mirrors the clinical role
 * resolution used by the dashboard profile.
 * @param {string} roleId - e.g. 'role_admin' (DB) or 'admin'
 * @param {string} [departmentId]
 * @returns {{label:string,icon:string,route:string}[]}
 */
export function getQuickActions(roleId, departmentId) {
  const clinical = CLINICAL_ROLE_MAP[(roleId || '').toLowerCase()];
  const key = clinical ? clinical.key : (roleId || '').toLowerCase().replace(/^role_/, '') || 'staff';
  const caps = getSession()?.capabilities || [];
  const allowed = (cap) => !cap || caps.includes(cap) || caps.includes('*');
  const actions = QUICK_ACTIONS[key] || QUICK_ACTIONS.staff;
  const userClass = getUserClass({ role_id: roleId });
  // Capability gate (L2) AND structural-class gate (UI framework) — both must pass.
  return actions.filter(a =>
    allowed(a.cap) && isFeatureAllowed(routeToFeatureId(a.route), userClass)
  );
}

/**
 * Builds the unified Dashboard tab structure shared by EVERY user:
 *   - Tab 1 is always "Overview" — the landing page holding all of the user's
 *     quick-navigation cards (rendered identically for all roles).
 *   - The remaining tabs are that user's own role actions, each broken out into
 *     its own single-page panel (e.g. "Add User", "View Audit Logs").
 * The shape is identical for all users; only the action tabs differ per role.
 * @param {string} roleId
 * @param {string} [departmentId]
 * @returns {{id:string,label:string,icon:string,kind:string,route?:string,cap?:string}[]}
 */
export function makeDashboardTabs(roleId, departmentId) {
  const actions = getQuickActions(roleId, departmentId);
  const tabs = [{ id: 'overview', label: 'Overview', icon: '🏠', kind: 'overview' }];
  actions.forEach((a, i) => {
    tabs.push({
      id: `qa-${i}`,
      label: a.label,
      icon: a.icon || '•',
      kind: 'action',
      route: a.route,
      cap: a.cap,
    });
  });
  return tabs;
}

// ── Session Management ───────────────────────────────────────

/**
 * Returns the current user session object, or null if not logged in.
 * @returns {object|null}
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
                || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.token) { clearSession(); return null; }
    const decoded = decodeToken(session.token);
    if (!decoded || (decoded.exp && Date.now() >= decoded.exp * 1000)) {
      clearSession();
      return null;
    }
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Saves a session object (after successful login).
 * @param {object} user
 * @param {boolean} remember — persist across browser close
 */
export function setSession(user, token, remember = false) {
  let session = {
    ...user,
    token,
    loginAt:   Date.now(),
    expiresAt: remember
      ? Date.now() + (30 * 24 * 60 * 60 * 1000)
      : Date.now() + (8 * 60 * 60 * 1000),
  };

  if (!session.role && session.role_id) {
    const rid = String(session.role_id).toLowerCase();
    if (rid === 'role_admin') session.role = 'admin';
    else if (rid === 'role_director') session.role = 'director';
    else if (rid === 'role_supervisor') session.role = 'supervisor';
    else if (rid === 'role_lead') session.role = 'lead';
    else if (rid === 'role_finance' || rid === 'role_dev' || rid === 'role_nurse') session.role = 'staff';
    else session.role = rid.replace(/^role_/, '');
  }

  const clinical = CLINICAL_ROLE_MAP[(session.role_id || '').toLowerCase()];
  if (clinical) session.clinical_role = clinical.key;

  const storage = remember ? localStorage : sessionStorage;
  if (session.role) session.role = session.role.toLowerCase();
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  if (remember) localStorage.setItem(REMEMBER_KEY, '1');
}

/**
 * Clears the session from all storage and redirects to login.
 */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

/**
 * Logs the current user out: clears session and redirects.
 */
export function logout() {
  try { clearSession(); } catch (e) { /* storage may be unavailable; ignore */ }
  // Hard navigation (replace, not href) so the back button can't return
  // to an authenticated view and the SPA state is fully reset.
  window.location.replace('login.html');
}

// ── Auth Guards ──────────────────────────────────────────────

/**
 * Checks if the user is logged in.
 * If not, redirects to login. Call at the top of any protected page.
 * @returns {object} session — the current user if valid
 */
export function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    return null;
  }
  return session;
}

/**
 * Checks if the current user has at least the specified role level.
 * @param {string} roleId — e.g. 'admin', 'supervisor'
 * @returns {boolean}
 */
export function hasRole(roleId) {
  const session = getSession();
  if (!session) return false;
  const required = ROLES[roleId.toUpperCase()]?.level ?? 99;
  const current  = ROLES[session.role?.toUpperCase()]?.level ?? 0;
  return current >= required;
}

/**
 * Checks if the current user can access a given module.
 * @param {string} moduleId
 * @returns {boolean}
 */
export function canAccessModule(moduleId) {
  const session = getSession();
  if (!session) return false;
  const cap = MODULE_CAPABILITIES[moduleId];
  if (cap) return canAccessCapability(cap);
  const required = MODULE_PERMISSIONS[moduleId] ?? 99;
  const current  = ROLES[session.role?.toUpperCase()]?.level ?? 0;
  return current >= required;
}

// ── Mock Auth (replace with real API call) ───────────────────

/**
 * Simulates an API login.
 * In production: replace with fetch('/api/auth/login', { method:'POST', body: ... })
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function loginRequest(email, password) {
  try{
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (res.ok && data.ok && data.user){
      return { success: true, user: data.user, token: data.token };
    }
    return { success: false, error: data && data.error ? data.error : 'Login failed' };
  }catch(e){
    return { success: false, error: 'Network error' };
  }
}

// ── Utility ──────────────────────────────────────────────────

/**
 * Returns a human-readable role label for the current user.
 * @returns {string}
 */
export function getUserRoleLabel() {
  const session = getSession();
  if (!session) return '';
  const clinical = CLINICAL_ROLE_MAP[(session.role_id || '').toLowerCase()];
  if (clinical) return clinical.label;
  return ROLES[session.role?.toUpperCase()]?.label ?? session.role;
}

/**
 * Redirects to login if unauthenticated, otherwise continues.
 * Also redirects away from login if already authenticated.
 * @param {'login'|'dashboard'} pageType
 */
export function authRedirect(pageType) {
  const session = getSession();
  if (pageType === 'login' && session) {
    window.location.href = 'index.html';
    return;
  }
  if (pageType === 'dashboard' && !session) {
    window.location.href = 'login.html';
    return;
  }
}