/**
 * ModuCare MS — Auth Module
 * Handles: session storage, auth guards, role checking, token management
 * Imported by: login.js, app.js, and any protected module
 */

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
  'operations-tasks':   1,
  'finance-billing':    2,
  'analytics-reports':  3,
  'scheduling-calendar':1,
  'communications':     1,
  'notifications':      1,
  'document-vault':     2,
  'audit-compliance':   3,
  'client-portal':      2,
  'integrations':       4,
  'system-admin':       5,
  'patients':           1,
};

// Role-specific dashboard cards and quick actions
export const DASHBOARD_PROFILES = {
  staff: {
    title: 'My Workspace',
    description: 'Your daily tasks, appointments, and patient queue.',
    cards: [
      { id: 'my-tasks', title: 'My Tasks', route: '/dashboard/tasks', icon: '📋', metric: '3 pending' },
      { id: 'appointments', title: 'Appointments', route: '/scheduling-calendar', icon: '📅', metric: '4 today' },
      { id: 'patients', title: 'My Patients', route: '/patients', icon: '👥', metric: '12 active' },
      { id: 'incidents', title: 'Incident Reporting', route: '/incident-reporting', icon: '🚨', metric: '0 open' },
      { id: 'communications', title: 'Communications', route: '/communications', icon: '💬', metric: '2 new' },
      { id: 'documents', title: 'Document Vault', route: '/document-vault', icon: '📁', metric: '5 pending' },
    ],
  },
  lead: {
    title: 'Team Lead Workspace',
    description: 'Team performance, scheduling, approvals, and reports.',
    cards: [
      { id: 'team-tasks', title: 'Team Tasks', route: '/dashboard/tasks', icon: '✅', metric: '8 open' },
      { id: 'schedule', title: 'Schedule', route: '/scheduling-calendar', icon: '📅', metric: '3 shifts' },
      { id: 'timesheets', title: 'Timesheets', route: '/finance-billing', icon: '⏱️', metric: '2 pending' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', metric: '1 review' },
      { id: 'communications', title: 'Communications', route: '/communications', icon: '💬', metric: '5 new' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', metric: '22 total' },
    ],
  },
  supervisor: {
    title: 'Supervisor Overview',
    description: 'Department oversight, compliance, and resource planning.',
    cards: [
      { id: 'compliance', title: 'Compliance', route: '/audit-compliance', icon: '🛡️', metric: 'Good' },
      { id: 'staffing', title: 'Staffing', route: '/staff', icon: '👥', metric: '22 active' },
      { id: 'operations', title: 'Operations', route: '/operations', icon: '⚙️', metric: '5 active' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', metric: 'KSh 48,200' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', metric: '2 open' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', metric: 'View all' },
    ],
  },
  director: {
    title: 'Director Dashboard',
    description: 'Hospital-wide KPIs, financials, staffing, and risk.',
    cards: [
      { id: 'kpi', title: 'KPIs', route: '/dashboard/kpi-1', icon: '📈', metric: 'On track' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', metric: 'KSh 48,200' },
      { id: 'staffing', title: 'Staffing', route: '/staff', icon: '👥', metric: '22 active' },
      { id: 'incidents', title: 'Risk / Incidents', route: '/incident-reporting', icon: '🚨', metric: '2 open' },
      { id: 'operations', title: 'Operations', route: '/operations', icon: '⚙️', metric: '5 active' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', metric: 'Overview' },
    ],
  },
  admin: {
    title: 'System Administration',
    description: 'User management, system health, audit logs, and access control.',
    cards: [
      { id: 'users', title: 'Users', route: '/admin', icon: '👤', metric: 'Manage' },
      { id: 'audit', title: 'Audit Logs', route: '/audit-compliance', icon: '📝', metric: '1,204 entries' },
      { id: 'health', title: 'System Health', route: '/dashboard/overview', icon: '🖥️', metric: 'Online' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', metric: '2 open' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', metric: 'KSh 48,200' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', metric: 'View all' },
    ],
  },
};

export function getDashboardProfile(roleId) {
  const key = (roleId || '').toLowerCase();
  return DASHBOARD_PROFILES[key] || DASHBOARD_PROFILES.staff;
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
    // Validate expiry
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Saves a session object (after successful login).
 * @param {object} user
 * @param {boolean} remember — persist across browser close
 */
export function setSession(user, remember = false) {
  const session = {
    ...user,
    loginAt:   Date.now(),
    expiresAt: remember
      ? Date.now() + (30 * 24 * 60 * 60 * 1000)  // 30 days
      : Date.now() + (8 * 60 * 60 * 1000),          // 8 hours
  };
  const storage = remember ? localStorage : sessionStorage;
  // normalize role to lowercase for consistency
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
  clearSession();
  window.location.href = 'login.html';
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
      return { success: true, user: data.user };
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
