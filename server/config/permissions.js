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
  'inventory:write':          'Manage inventory stock',
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
};

// Seed mapping: role_id -> capabilities. This is the default that gets
// written into role_permissions on first run (INSERT OR IGNORE keeps it
// editable directly in the DB afterwards).
const ROLE_CAPABILITY_SEED = {
  role_admin:     Object.keys(CAPABILITIES), // full control

  role_dev: [ // Front-Desk / Intake
    'patient:read', 'patient:register', 'patient:write_demographics',
    'appointment:read', 'appointment:write',
    'communication:read', 'communication:write',
    'incident:read', 'incident:write',
  ],

  role_nurse: [ // Clinical Staff / Triage
    'patient:read', 'patient:write_demographics', 'patient:write_vitals',
    'encounter:read', 'encounter:write',
    'appointment:read',
    'incident:read', 'incident:write',
  ],

  role_lead: [ // Healthcare Provider
    'patient:read', 'patient:write_clinical', 'patient:write_vitals',
    'prescription:write', 'lab:order', 'lab:read',
    'encounter:read', 'encounter:write',
    'referral:write', 'incident:read', 'incident:write',
    'appointment:read',
  ],

  role_supervisor: [ // Facility Analytics & M&E
    'analytics:read', 'report:export', 'audit:read',
    'finance:read', 'patient:read', 'incident:read',
  ],

  role_director: [ // Facility Analytics & M&E (director)
    'analytics:read', 'report:export', 'audit:read',
    'finance:read', 'finance:write', 'patient:read',
    'system:health', 'incident:read',
  ],

  role_finance: [ // Ancillary Services (billing + pharmacy/inventory fulfillment)
    'finance:read', 'finance:write',
    'pharmacy:inventory_read', 'inventory:read', 'inventory:write',
    'lab:result_entry', 'pharmacy:dispense', 'lab:read',
    'patient:read',
  ],
};

// Module id -> capability required to access it (frontend nav gating).
const MODULE_CAPABILITIES = {
  'dashboard':          'patient:read',
  'patients':           'patient:read',
  'scheduling-calendar':'appointment:read',
  'operations-tasks':   'patient:read',
  'communications':     'communication:read',
  'document-vault':    'patient:read',
  'incident-reporting': 'incident:read',
  'clinical':           'encounter:read',
  'encounters':         'encounter:read',
  'lab-orders':         'lab:read',
  'pharmacy':           'pharmacy:inventory_read',
  'finance-billing':    'finance:read',
  'analytics-reports':  'analytics:read',
  'audit-compliance':   'audit:read',
  'admin':              'user:manage',
  'system-health':      'system:health',
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
        const stmt = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, capability) VALUES (?, ?)`);
        for (const [roleId, caps] of Object.entries(ROLE_CAPABILITY_SEED)) {
          for (const cap of caps) stmt.run(roleId, cap);
        }
        stmt.finalize((ferr) => ferr ? reject(ferr) : resolve());
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
