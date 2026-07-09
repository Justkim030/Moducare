/**
 * ModuCare MS — Capability (RBAC) Engine
 *
 * Source of truth for "what a role can DO". Capabilities are seeded into the
 * `role_permissions` table (dynamic / editable) and loaded into memory at
 * startup. The frontend only *renders* what this server returns; every
 * sensitive action is re-checked server-side via enforceCapability().
 *
 * Depth levels:
 *   L1 (UI)  — frontend hides cards/nav by capability
 *   L2 (CRUD)— controllers reject actions lacking the capability
 *   (L3 field/row scoping is a future extension.)
 */

// Capability catalog: kept as documentation + validation surface.
const CAPABILITIES = {
  'dashboard:view':           'View dashboard (role-scoped aggregates)',
  'staff:read':               'View staff / HR deployment',
  'operations:read':          'View operations & facility queue',
  'clinical:read':            'View clinical module (triage/orders/CDSS)',
  'patient:read':             'View patient records',
  'patient:register':         'Register a new patient',
  'patient:write_demographics':'Edit demographic / intake data',
  'patient:write_vitals':     'Capture triage vitals & screening',
  'patient:write_clinical':   'Write diagnosis / clinical notes',
  'prescription:write':       'Write prescriptions / order entry',
  'lab:order':                'Request lab tests',
  'lab:result_entry':         'Enter lab results',
  'lab:read':                 'View lab orders & results',
  'pharmacy:dispense':        'Dispense medication',
  'pharmacy:inventory_read':  'View pharmaceutical inventory',
  'inventory:read':           'View facility inventory & stock alerts',
  'inventory:write':           'Manage inventory stock',
  'inventory:reconcile':       'Reconcile inventory against physical counts',
  'inventory:audit':           'View inventory audit / adjustment trail',
  'inventory:adjust':          'Create stock adjustments',
  'inventory:transfer':        'Create / approve stock transfers',
  'appointment:read':         'View appointments / schedule',
  'appointment:write':        'Create / update appointments',
  'encounter:read':           'View clinical encounters',
  'encounter:write':          'Document an encounter',
  'incident:read':            'View incident reports',
  'incident:write':           'File an incident report',
  'referral:write':           'Create referrals / discharges',
  'communication:read':       'Read communications',
  'communication:write':      'Send communications',
  'finance:read':             'View billing & finance',
  'finance:write':            'Manage billing & finance',
  'analytics:read':           'View M&E / analytics',
  'report:export':            'Export MoH / compliance reports',
  'audit:read':               'View audit & compliance logs',
  'user:manage':              'Provision / manage users',
  'role:manage':              'Manage roles & permissions',
  'system:health':            'View system health',
  'backup:manage':            'Manage database backups',
  'attendance:clock':         'Clock in / out (time & attendance)',
  'attendance:approve':       'Manage / approve attendance records',
  'attendance:view':          'View attendance records',
  'leave:create':             'Create leave requests',
  'leave:approve':            'Approve / reject leave requests',
};

// Seed mapping: role_id -> capabilities. This is the default that gets
// written into role_permissions on first run (INSERT OR IGNORE keeps it
// editable directly in the DB afterwards). Visibility caps (dashboard:view,
// staff:read, operations:read, clinical:read, etc.) encode the Admin
// "Role Filtering Matrix"; functional caps encode Level 2 (CRUD) enforcement.
const ROLE_CAPABILITY_SEED = {
  role_admin: [
    'dashboard:view', 'staff:read', 'operations:read',
    'inventory:read', 'inventory:write',
    'inventory:reconcile', 'inventory:audit', 'inventory:adjust', 'inventory:transfer',
    'appointment:read', 'appointment:write',
    'finance:read', 'finance:write',
    'audit:read', 'user:manage', 'role:manage',
    'attendance:clock', 'attendance:approve', 'attendance:view',
    'leave:create', 'leave:approve',
    'system:health', 'backup:manage'
  ],

  role_dev: [ // Front-Desk / Intake (Dashboard, Patients, Staff, Finance, Operations, Incidents, Notifications)
    'dashboard:view', 'patient:read', 'staff:read', 'finance:read', 'operations:read', 'incident:read',
    'patient:register', 'patient:write_demographics',
    'appointment:read', 'appointment:write',
    'incident:write', 'communication:read',
  ],

  role_nurse: [ // Clinical Staff / Triage (Dashboard, Patients, Staff, Operations, Clinical, Incidents, Communications, Notifications, Referrals)
    'dashboard:view', 'patient:read', 'staff:read', 'operations:read', 'clinical:read', 'incident:read',
    'patient:write_demographics', 'patient:write_vitals',
    'encounter:read', 'encounter:write',
    'appointment:read', 'incident:write',
    'communication:read', 'communication:write', 'referral:write',
  ],

  role_lead: [ // Healthcare Provider (Dashboard, Patients, Staff, Operations, Clinical, Communications, Incidents)
    'dashboard:view', 'patient:read', 'staff:read', 'operations:read', 'clinical:read', 'communication:read', 'incident:read',
    'patient:write_clinical', 'patient:write_vitals',
    'prescription:write', 'lab:order', 'lab:read',
    'encounter:read', 'encounter:write',
    'referral:write', 'incident:write', 'appointment:read',
  ],

  role_supervisor: [ // M&E Officer (Dashboard, Patients, Finance, Operations, Audit, Incidents, Communications, Notifications)
    'dashboard:view', 'patient:read', 'finance:read', 'operations:read', 'incident:read', 'audit:read',
    'analytics:read', 'report:export', 'communication:read',
    'inventory:audit', 'attendance:view', 'leave:approve', 'role:manage',
  ],

  role_director: [ // M&E Officer (director) — same visibility, adds finance/system manage, Communications, Notifications, Staff
    'dashboard:view', 'patient:read', 'staff:read', 'finance:read', 'operations:read', 'incident:read', 'audit:read',
    'analytics:read', 'report:export', 'finance:write', 'system:health', 'communication:read',
    'inventory:reconcile', 'inventory:audit', 'attendance:view', 'leave:approve', 'role:manage',
  ],

  role_finance: [ // Ancillary (Lab/Pharmacy): Dashboard, Patients, Finance, Operations, Clinical, Incidents, Notifications
    'dashboard:view', 'patient:read', 'finance:read', 'operations:read', 'clinical:read', 'incident:read',
    'finance:write', 'communication:read',
    'pharmacy:inventory_read', 'inventory:read', 'inventory:write',
    'lab:result_entry', 'pharmacy:dispense', 'lab:read',
  ],
};

// Module id -> capability required to *view* it in the sidebar (L1 gating).
// Maps directly to the Admin "Role Filtering Matrix".
const MODULE_CAPABILITIES = {
  'dashboard':           'dashboard:view',
  'patients':            'patient:read',
  'staff':               'staff:read',
  'finance-billing':     'finance:read',
  'operations':          'operations:read',
  'clinical':            'clinical:read',
  'communications':      'communication:read',
  'audit-compliance':    'audit:read',
  'incident-reporting':  'incident:read',
  // supporting / nested views
  'scheduling-calendar': 'appointment:read',
  'documents':           'patient:read',
  'encounters':          'encounter:read',
  'lab-orders':          'lab:read',
  'pharmacy':            'pharmacy:inventory_read',
  'inventory':           'inventory:read',
  'analytics-reports':   'analytics:read',
  'admin':               'user:manage',
  'system-health':       'system:health',
};

const db = require('./db');

let roleCaps = new Map(); // role_id -> Set(capability)
let loaded = false;
let loadPromise = null;

function seedRolePermissions() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL,
        capability TEXT NOT NULL,
        PRIMARY KEY (role_id, capability)
      )`, (err) => {
        if (err) return reject(err);

        db.run(`DELETE FROM role_permissions WHERE role_id = 'role_admin'`, (err) => {
          if (err) return reject(err);

          const adminStmt = db.prepare(`INSERT INTO role_permissions (role_id, capability) VALUES (?, ?)`);
          const adminCaps = ROLE_CAPABILITY_SEED['role_admin'] || [];
          for (const cap of adminCaps) adminStmt.run('role_admin', cap);
          adminStmt.finalize((ferr) => {
            if (ferr) return reject(ferr);

            const insertStmt = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, capability) VALUES (?, ?)`);
            for (const [roleId, caps] of Object.entries(ROLE_CAPABILITY_SEED)) {
              if (roleId === 'role_admin') continue;
              for (const cap of caps) insertStmt.run(roleId, cap);
            }
            insertStmt.finalize((ferr2) => ferr2 ? reject(ferr2) : resolve());
          });
        });
      });
    });
  });
}

function loadCapabilities() {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    db.all(`SELECT role_id, capability FROM role_permissions`, (err, rows) => {
      if (err) return reject(err);
      const map = new Map();
      for (const row of rows || []) {
        if (!map.has(row.role_id)) map.set(row.role_id, new Set());
        map.get(row.role_id).add(row.capability);
      }
      roleCaps = map;
      loaded = true;
      resolve(map);
    });
  });
  return loadPromise;
}

function getCapabilities(roleId) {
  if (!roleId) return [];
  const set = roleCaps.get(String(roleId)) || new Set();
  return Array.from(set);
}

function hasCapability(roleId, capability) {
  if (capability === '*') return true;
  const set = roleCaps.get(String(roleId));
  if (!set) return false;
  return set.has('*') || set.has(capability);
}

function getModulesForRole(roleId) {
  const modules = [];
  for (const [mod, cap] of Object.entries(MODULE_CAPABILITIES)) {
    if (hasCapability(roleId, cap)) modules.push(mod);
  }
  return modules;
}

async function initCapabilities() {
  await seedRolePermissions();
  await loadCapabilities();
  return roleCaps;
}

module.exports = {
  CAPABILITIES,
  ROLE_CAPABILITY_SEED,
  MODULE_CAPABILITIES,
  initCapabilities,
  seedRolePermissions,
  loadCapabilities,
  getCapabilities,
  hasCapability,
  getModulesForRole,
  isLoaded: () => loaded,
};
