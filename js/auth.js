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

// Department-based card filtering
export const DEPARTMENT_MODULES = {
  'Finance': ['finance-billing', 'patients', 'notifications'],
  'Clinical Services': ['patients', 'scheduling-calendar', 'operations-tasks', 'communications', 'notifications'],
  'IT Engineering': ['operations-tasks', 'communications', 'document-vault'],
  'Administration': ['audit-compliance', 'system-admin', 'patients', 'finance-billing'],
};

// Role-specific dashboard cards and quick actions
export const DASHBOARD_PROFILES = {
  staff: {
    title: 'My Workspace',
    description: 'Your daily tasks, appointments, and patient queue.',
    cards: [
      { id: 'my-tasks', title: 'My Tasks', route: '/dashboard/tasks', icon: '📋', data: 'tasks', module: 'operations-tasks' },
      { id: 'appointments', title: 'Appointments', route: '/scheduling-calendar', icon: '📅', data: 'appointments', module: 'scheduling-calendar' },
      { id: 'patients', title: 'My Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
      { id: 'incidents', title: 'Incident Reporting', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'communications', title: 'Communications', route: '/communications', icon: '💬', data: 'notifications', module: 'communications' },
      { id: 'documents', title: 'Document Vault', route: '/document-vault', icon: '📁', data: 'documents', module: 'document-vault' },
    ],
  },
  lead: {
    title: 'Team Lead Workspace',
    description: 'Team performance, scheduling, approvals, and reports.',
    cards: [
      { id: 'team-tasks', title: 'Team Tasks', route: '/dashboard/tasks', icon: '✅', data: 'teamTasks', module: 'operations-tasks' },
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
      { id: 'staffing', title: 'Staffing', route: '/staff', icon: '👥', data: 'patients', module: 'patients' },
      { id: 'operations', title: 'Operations', route: '/operations', icon: '⚙️', data: 'totalOperations', module: 'operations-tasks' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', data: 'finance', module: 'finance-billing' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
  director: {
    title: 'Director Dashboard',
    description: 'Hospital-wide KPIs, financials, staffing, and risk.',
    cards: [
      { id: 'kpi', title: 'KPIs', route: '/dashboard/kpi-1', icon: '📈', data: 'totalOperations', module: 'operations-tasks' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', data: 'finance', module: 'finance-billing' },
      { id: 'staffing', title: 'Staffing', route: '/staff', icon: '👥', data: 'patients', module: 'patients' },
      { id: 'incidents', title: 'Risk / Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'operations', title: 'Operations', route: '/operations', icon: '⚙️', data: 'totalOperations', module: 'operations-tasks' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
  admin: {
    title: 'System Administration',
    description: 'User management, system health, audit logs, and access control.',
    cards: [
      { id: 'users', title: 'Users', route: '/admin', icon: '👤', data: 'users', module: 'system-admin' },
      { id: 'audit', title: 'Audit Logs', route: '/audit-compliance', icon: '📝', data: 'audit', module: 'audit-compliance' },
      { id: 'health', title: 'System Health', route: '/dashboard/overview', icon: '🖥️', data: 'totalOperations', module: 'operations-tasks' },
      { id: 'incidents', title: 'Incidents', route: '/incident-reporting', icon: '🚨', data: 'incidents', module: 'audit-compliance' },
      { id: 'finance', title: 'Finance', route: '/finance-billing', icon: '💰', data: 'finance', module: 'finance-billing' },
      { id: 'patients', title: 'Patients', route: '/patients', icon: '👥', data: 'patients', module: 'patients' },
    ],
  },
};

export function getDashboardProfile(roleId, departmentId) {
  const key = (roleId || '').toLowerCase();
  let profile = DASHBOARD_PROFILES[key] || DASHBOARD_PROFILES.staff;
  
  // Filter cards by department for staff-level users
  if (roleId === 'staff' || roleId === 'STAFF') {
    const allowedModules = DEPARTMENT_MODULES[departmentId] || [];
    profile = {
      ...profile,
      cards: profile.cards.filter(card => {
        if (!card.module) return true;
        const requiredLevel = MODULE_PERMISSIONS[card.module] || 0;
        const userLevel = ROLES['STAFF'].level;
        return userLevel >= requiredLevel && allowedModules.includes(card.module);
      })
    };
  }
  
  return profile;
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
    else if (rid === 'role_dev' || rid === 'role_nurse') session.role = 'staff';
    else session.role = rid.replace(/^role_/, '');
  }

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