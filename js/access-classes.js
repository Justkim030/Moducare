/**
 * ModuCare MS — Structural Access Classes
 * UI rendering framework: groups roles into 4 classes (A/B/C/D) so the sidebar
 * and quick-nav build themselves from FEATURE_NAV metadata instead of
 * hand-written per-role rules.
 *
 * ⚠️ This module drives UI VISIBILITY ONLY. Real authorization is enforced
 * server-side by the capability engine (server/config/permissions.js). "What a
 * user must not see" is derived as the ABSENCE of the required capability — not
 * a separate denylist keyed by role name — so it cannot be bypassed by renaming
 * a role.
 */
export const STRUCTURAL_CLASSES = {
  A: { id: 'A', name: 'Governance & Infrastructure', focus: 'System uptime, logs, and database security.' },
  B: { id: 'B', name: 'Direct Care Providers',       focus: 'Longitudinal, real-time patient interactions and workflows.' },
  C: { id: 'C', name: 'Ancillary & Operations',       focus: 'Data input, order fulfillment, scheduling, and logistical queues.' },
  D: { id: 'D', name: 'Public Health & Training',     focus: 'Aggregate performance, audits, data quality, and workforce onboarding.' },
};

// One catalog entry per src/features directory.
// accessible_by_classes : positive allowlist (the rendering source of truth).
// explicit_denials      : defensive class-level denials (mirrors the framework spec).
export const FEATURE_NAV = [
  { feature_id: 'dashboard',           display_name: 'Dashboard',           base_folder: 'src/features/dashboard',          accessible_by_classes: ['A','B','C','D'], explicit_denials: [] },
  { feature_id: 'patients',            display_name: 'Patients',            base_folder: 'src/features/patients',           accessible_by_classes: ['B','C','D'],       explicit_denials: ['A'] },
  { feature_id: 'appointments',        display_name: 'Appointments',        base_folder: 'src/features/appointments',       accessible_by_classes: ['B','C'],          explicit_denials: ['A','D'] },
  { feature_id: 'scheduling-calendar', display_name: 'Scheduling Calendar', base_folder: 'src/features/scheduling-calendar', accessible_by_classes: ['B','C'],          explicit_denials: ['A','D'] },
  { feature_id: 'encounters',          display_name: 'Clinical Encounters', base_folder: 'src/features/encounters',         accessible_by_classes: ['B'],               explicit_denials: ['A','C','D'] },
  { feature_id: 'lab-orders',          display_name: 'Lab Orders',          base_folder: 'src/features/lab-orders',         accessible_by_classes: ['B','C'],          explicit_denials: ['A','D'] },
  { feature_id: 'pharmacy',            display_name: 'Pharmacy',            base_folder: 'src/features/pharmacy',           accessible_by_classes: ['B','C'],          explicit_denials: ['A','D'] },
  { feature_id: 'inventory',           display_name: 'Inventory',           base_folder: 'src/features/inventory',          accessible_by_classes: ['C'],               explicit_denials: ['A','B','D'] },
  { feature_id: 'incident-reporting',  display_name: 'Incident Reporting',   base_folder: 'src/features/incident-reporting',  accessible_by_classes: ['B'],               explicit_denials: ['A','C','D'] },
  { feature_id: 'communications',      display_name: 'Communications',      base_folder: 'src/features/communications',     accessible_by_classes: ['B','D'],          explicit_denials: ['A','C'] },
  { feature_id: 'finance-billing',     display_name: 'Finance & Billing',    base_folder: 'src/features/finance-billing',    accessible_by_classes: ['A','D'],          explicit_denials: ['B','C'] },
  { feature_id: 'operations',          display_name: 'Operations',          base_folder: 'src/features/operations',         accessible_by_classes: ['A','C','D'],      explicit_denials: ['B'] },
  { feature_id: 'staff',               display_name: 'Staff',               base_folder: 'src/features/staff',              accessible_by_classes: ['A','D'],          explicit_denials: ['B','C'] },
  { feature_id: 'admin',               display_name: 'Admin / User Mgmt',   base_folder: 'src/features/admin',              accessible_by_classes: ['A'],               explicit_denials: ['B','C','D'] },
  { feature_id: 'audit-compliance',    display_name: 'Audit & Compliance',   base_folder: 'src/features/audit-compliance',   accessible_by_classes: ['A','D'],          explicit_denials: ['B','C'] },
  { feature_id: 'audit',               display_name: 'Audit Logs',          base_folder: 'src/features/audit',              accessible_by_classes: ['A','D'],          explicit_denials: ['B','C'] },
  { feature_id: 'analytics-reports',   display_name: 'Analytics & Reports',  base_folder: 'src/features/analytics-reports',  accessible_by_classes: ['D'],               explicit_denials: ['A','B','C'] },
  { feature_id: 'documents',           display_name: 'Document Vault',      base_folder: 'src/features/document-vault',     accessible_by_classes: ['D'],               explicit_denials: ['A','B','C'] },
  { feature_id: 'notifications',       display_name: 'Notifications',       base_folder: 'src/features/notifications',      accessible_by_classes: ['B','C','D'],      explicit_denials: ['A'] },
  { feature_id: 'profile',             display_name: 'Profile',             base_folder: 'src/features/profile',            accessible_by_classes: ['B','C','D'],      explicit_denials: ['A'] },
  { feature_id: 'referrals',           display_name: 'Referrals',           base_folder: 'src/features/referrals',          accessible_by_classes: ['B'],               explicit_denials: ['A','C','D'] },
  { feature_id: 'settings',            display_name: 'Settings',            base_folder: 'src/features/settings',           accessible_by_classes: ['A'],               explicit_denials: ['B','C','D'] },
  { feature_id: 'secret-login',        display_name: 'Emergency Backdoor',   base_folder: 'src/features/secret-login',       accessible_by_classes: ['A'],               explicit_denials: ['B','C','D'] },
];

// DB role_id (or legacy role) -> structural class.
const ROLE_TO_CLASS = {
  role_admin: 'A', role_dev: 'C', role_nurse: 'B', role_lead: 'B',
  role_supervisor: 'D', role_director: 'D', role_finance: 'C',
  admin: 'A', dev: 'C', nurse: 'B', lead: 'B', supervisor: 'D', director: 'D', finance: 'C',
};

export function getClassForRole(roleId) {
  return ROLE_TO_CLASS[(roleId || '').toLowerCase()] || 'C';
}

export function getUserClass(session) {
  return getClassForRole(session?.role_id || session?.role || '');
}

export function isFeatureAllowed(featureId, structuralClass) {
  const f = FEATURE_NAV.find(x => x.feature_id === featureId);
  if (!f) return false;
  if (f.explicit_denials.includes(structuralClass)) return false;
  return f.accessible_by_classes.includes(structuralClass);
}

export function getAllowedFeatures(structuralClass) {
  return FEATURE_NAV.filter(f => isFeatureAllowed(f.feature_id, structuralClass)).map(f => f.feature_id);
}

export function routeToFeatureId(route = '/') {
  const seg = route.replace(/^\/+/, '').split('/')[0];
  return seg || 'dashboard';
}
