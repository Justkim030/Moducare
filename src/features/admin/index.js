import { showToast, escapeHTML, apiFetch, formatDate } from '../../../js/utils.js';

const ROLE_LABELS = {
  role_admin: 'System Administrator',
  role_dev: 'Front-Desk / Intake',
  role_nurse: 'Clinical Staff / Triage',
  role_lead: 'Healthcare Provider',
  role_supervisor: 'M&E Officer',
  role_director: 'M&E Director',
  role_finance: 'Ancillary Services',
};

// Capability → display label (used to humanize the matrix rows)
const CAPABILITY_LABELS = {
  'dashboard:view': 'View Dashboard',
  'user:manage': 'Manage Users',
  'role:manage': 'Manage Roles',
  'system:health': 'System Health',
  'backup:manage': 'Manage Backups',
  'patient:read': 'Read Patients',
  'patient:register': 'Register Patient',
  'patient:write_demographics': 'Edit Demographics',
  'patient:write_vitals': 'Edit Vitals',
  'patient:write_clinical': 'Edit Clinical Notes',
  'clinical:read': 'Read Clinical',
  'encounter:read': 'Read Encounters',
  'encounter:write': 'Write Encounters',
  'lab:read': 'Read Labs',
  'lab:order': 'Order Labs',
  'lab:result_entry': 'Enter Lab Results',
  'prescription:write': 'Write Prescriptions',
  'referral:write': 'Write Referrals',
  'pharmacy:dispense': 'Dispense Pharmacy',
  'pharmacy:inventory_read': 'Read Pharmacy Inventory',
  'appointment:read': 'Read Appointments',
  'appointment:write': 'Write Appointments',
  'finance:read': 'Read Finance',
  'finance:write': 'Write Finance',
  'inventory:read': 'Read Inventory',
  'inventory:write': 'Write Inventory',
  'inventory:reconcile': 'Reconcile Inventory',
  'inventory:audit': 'Audit Inventory',
  'inventory:adjust': 'Adjust Inventory',
  'inventory:transfer': 'Transfer Inventory',
  'operations:read': 'Read Operations',
  'staff:read': 'Read Staff',
  'attendance:clock': 'Clock Attendance',
  'attendance:approve': 'Approve Attendance',
  'attendance:view': 'View Attendance',
  'leave:create': 'Create Leave',
  'leave:approve': 'Approve Leave',
  'communication:read': 'Read Communications',
  'communication:write': 'Write Communications',
  'audit:read': 'Read Audit',
  'report:export': 'Export Reports',
  'analytics:read': 'Read Analytics',
  'incident:read': 'Read Incidents',
  'incident:write': 'Write Incidents',
};

// Ordered capability groups used to lay out the permission matrix
const CAPABILITY_GROUPS = [
  { category: 'System', caps: ['dashboard:view', 'user:manage', 'role:manage', 'system:health', 'backup:manage'] },
  { category: 'Patient', caps: ['patient:read', 'patient:register', 'patient:write_demographics', 'patient:write_vitals', 'patient:write_clinical'] },
  { category: 'Clinical', caps: ['clinical:read', 'encounter:read', 'encounter:write', 'lab:read', 'lab:order', 'lab:result_entry', 'prescription:write', 'referral:write'] },
  { category: 'Pharmacy', caps: ['pharmacy:dispense', 'pharmacy:inventory_read'] },
  { category: 'Appointments', caps: ['appointment:read', 'appointment:write'] },
  { category: 'Finance', caps: ['finance:read', 'finance:write', 'inventory:read', 'inventory:write', 'inventory:reconcile', 'inventory:audit', 'inventory:adjust', 'inventory:transfer'] },
  { category: 'Operations', caps: ['operations:read'] },
  { category: 'HR', caps: ['staff:read', 'attendance:clock', 'attendance:approve', 'attendance:view', 'leave:create', 'leave:approve'] },
  { category: 'Communications', caps: ['communication:read', 'communication:write'] },
  { category: 'Audit', caps: ['audit:read', 'report:export', 'analytics:read', 'incident:read', 'incident:write'] },
];

let _permissionsLoaded = false;
let _auditLoaded = false;

export async function init(mount, State) {
  mount.querySelector('#btn-new-user')?.addEventListener('click', () => openCreateModal(mount));
  mount.querySelector('#modal-close')?.addEventListener('click', () => closeModal(mount));
  mount.querySelector('#user-modal-root')?.addEventListener('click', (e) => {
    if (e.target.id === 'user-modal-root') closeModal(mount);
  });

  // Tab switching
  mount.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(mount, tab.dataset.tab));
  });

  mount.querySelector('#btn-save-permissions')?.addEventListener('click', () => saveRolePermissions(mount));
  mount.querySelector('#btn-refresh-audit')?.addEventListener('click', () => loadRoleAudit(mount));

  await loadUsers(mount);
}

function switchTab(mount, tab) {
  mount.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  mount.querySelectorAll('.admin-panel').forEach(p => {
    p.style.display = (p.dataset.panel === tab) ? '' : 'none';
  });

  if (tab === 'permissions' && !_permissionsLoaded) {
    loadRolePermissions(mount).then(() => { _permissionsLoaded = true; });
  }
  if (tab === 'audit' && !_auditLoaded) {
    loadRoleAudit(mount).then(() => { _auditLoaded = true; });
  }
}

// ── Users ─────────────────────────────────────────────────────
async function loadUsers(mount) {
   const wrap = mount.querySelector('#users-table-wrap');
   const empty = mount.querySelector('#users-empty');
   wrap.innerHTML = '<tr><td colspan="5" class="mc-muted">Loading...</td></tr>';
   empty?.classList.add('hidden');

   try {
     const data = await apiFetch('/users');
     if (!data.ok) throw new Error(data?.error || 'Failed');

     const users = data.users || [];
    if (users.length === 0) {
      wrap.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

      wrap.innerHTML = users.map(u => `
        <tr data-id="${u.id}">
          <td class="name font-weight-500">${escapeHTML(u.name || '—')}</td>
          <td class="email text-secondary">${escapeHTML(u.email)}</td>
          <td><span class="badge badge-primary">${ROLE_LABELS[u.role] || u.role || 'staff'}</span></td>
          <td class="text-secondary">${escapeHTML(u.phone_number || '—')}</td>
          <td class="text-right">
            <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${u.id}">Edit</button>
            <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${u.id}">Delete</button>
          </td>
        </tr>
      `).join('');

    wrap.querySelectorAll('[data-action="edit"]').forEach(b => b.addEventListener('click', () => openEditModal(mount, b.dataset.id)));
    wrap.querySelectorAll('[data-action="delete"]').forEach(b => b.addEventListener('click', () => deleteUser(mount, b.dataset.id)));
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="5" class="mc-muted">Failed to load users.</td></tr>';
  }
}

async function openCreateModal(mount) {
  const title = mount.querySelector('#modal-title');
  const body = mount.querySelector('#modal-body');
  title.textContent = 'Register New User';
  body.innerHTML = `
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Full Name *</label>
        <input id="u-name" class="input" placeholder="e.g. Daniel Mach Reech" />
        <span class="ir-field-error" id="err-name"></span>
      </div>
      <div class="input-group">
        <label class="input-label">Work Email *</label>
        <input id="u-email" class="input" type="email" placeholder="user@moducare.org" />
        <span class="ir-field-error" id="err-email"></span>
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Password *</label>
        <input id="u-pass" class="input" type="password" placeholder="Minimum 4 characters" />
        <span class="ir-field-error" id="err-pass"></span>
      </div>
      <div class="input-group">
        <label class="input-label">Phone</label>
        <input id="u-phone" class="input" placeholder="+254..." />
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Role *</label>
      <select id="u-role" class="input">
        <option value="role_nurse">Clinical Staff / Triage</option>
        <option value="role_dev">Front-Desk / Intake</option>
        <option value="role_lead">Healthcare Provider</option>
        <option value="role_supervisor">M&E Officer</option>
        <option value="role_director">M&E Director</option>
        <option value="role_finance">Ancillary Services</option>
        <option value="role_admin">System Administrator</option>
      </select>
    </div>
    <div class="flex justify-between mt-sp-4">
      <button class="mc-btn" id="modal-cancel">Cancel</button>
      <button class="mc-btn btn-primary" id="modal-save">Create User</button>
    </div>
  `;

  mount.querySelector('#modal-cancel').addEventListener('click', () => closeModal(mount));
  mount.querySelector('#modal-save').addEventListener('click', () => createUser(mount));
  openModal(mount);
}

async function openEditModal(mount, id) {
   const title = mount.querySelector('#modal-title');
   const body = mount.querySelector('#modal-body');
   let user = null;
   try {
     const data = await apiFetch('/users');
     if (data.ok) user = (data.users || []).find(u => u.id === id);
   } catch (e) { user = null; }

  if (!user) {
    showToast('User not found.', 'warning');
    return;
  }

  title.textContent = 'Edit User';
  body.innerHTML = `
    <div class="input-group">
      <label class="input-label">Full Name</label>
      <input id="u-name" class="input" value="${escapeHTML(user.name || '')}" />
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Email</label>
        <input id="u-email" class="input" type="email" value="${escapeHTML(user.email || '')}" />
      </div>
      <div class="input-group">
        <label class="input-label">Phone</label>
        <input id="u-phone" class="input" value="${escapeHTML(user.phone_number || '')}" />
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">New Password (leave blank to keep)</label>
        <input id="u-pass" class="input" type="password" placeholder="••••••" />
      </div>
      <div class="input-group">
        <label class="input-label">Role</label>
        <select id="u-role" class="input">
          <option value="role_nurse" ${user.role === 'role_nurse' ? 'selected' : ''}>Clinical Staff / Triage</option>
          <option value="role_dev" ${user.role === 'role_dev' ? 'selected' : ''}>Front-Desk / Intake</option>
          <option value="role_lead" ${user.role === 'role_lead' ? 'selected' : ''}>Healthcare Provider</option>
          <option value="role_supervisor" ${user.role === 'role_supervisor' ? 'selected' : ''}>M&E Officer</option>
          <option value="role_director" ${user.role === 'role_director' ? 'selected' : ''}>M&E Director</option>
          <option value="role_finance" ${user.role === 'role_finance' ? 'selected' : ''}>Ancillary Services</option>
          <option value="role_admin" ${user.role === 'role_admin' ? 'selected' : ''}>System Administrator</option>
        </select>
      </div>
    </div>
    <div class="flex justify-between mt-sp-4">
      <button class="mc-btn" id="modal-cancel">Cancel</button>
      <button class="mc-btn btn-primary" id="modal-save">Save Changes</button>
    </div>
  `;

  mount.querySelector('#modal-cancel').addEventListener('click', () => closeModal(mount));
  mount.querySelector('#modal-save').addEventListener('click', () => updateUser(mount, id));
  openModal(mount);
}

async function createUser(mount) {
  const name = mount.querySelector('#u-name')?.value.trim();
  const email = mount.querySelector('#u-email')?.value.trim();
  const pass = mount.querySelector('#u-pass')?.value;
  const phone = mount.querySelector('#u-phone')?.value.trim();
  const role = mount.querySelector('#u-role')?.value;
  const errName = mount.querySelector('#err-name');
  const errEmail = mount.querySelector('#err-email');
  const errPass = mount.querySelector('#err-pass');

  let valid = true;
  if (!name) { if (errName) errName.textContent = 'Name required.'; valid = false; } else { if (errName) errName.textContent = ''; }
  if (!email) { if (errEmail) errEmail.textContent = 'Email required.'; valid = false; } else { if (errEmail) errEmail.textContent = ''; }
  if (!pass || pass.length < 4) { if (errPass) errPass.textContent = 'Password must be 4+ characters.'; valid = false; } else { if (errPass) errPass.textContent = ''; }
  if (!valid) return;

 try {
     const data = await apiFetch('/users', {
       method: 'POST',
       body: JSON.stringify({ name, email, password: pass, phone_number: phone, role_id: role })
     });
     if (!data.ok) throw new Error(data?.error || 'Failed');
     showToast('User created successfully.', 'success');
     closeModal(mount);
     loadUsers(mount);
   } catch (e) {
     showToast(e.message || 'Create failed.', 'error');
   }
 }

async function updateUser(mount, id) {
   const name = mount.querySelector('#u-name')?.value.trim();
   const email = mount.querySelector('#u-email')?.value.trim();
   const pass = mount.querySelector('#u-pass')?.value;
   const phone = mount.querySelector('#u-phone')?.value.trim();
   const role = mount.querySelector('#u-role')?.value;

   const payload = { name, email, role_id: role };
   if (pass && pass.length >= 4) payload.password = pass;

   try {
     const data = await apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
     if (!data.ok) throw new Error(data?.error || 'Failed');
     showToast('User updated.', 'success');
     closeModal(mount);
     loadUsers(mount);
   } catch (e) {
     showToast(e.message || 'Update failed.', 'error');
   }
 }

 async function deleteUser(mount, id) {
   if (!confirm('Delete this user? Their patient/appointment relations must be cleared manually if needed.')) return;
   try {
     const data = await apiFetch(`/users/${id}`, { method: 'DELETE' });
     if (!data.ok) throw new Error(data?.error || 'Failed');
     showToast('User deleted.', 'success');
     loadUsers(mount);
   } catch (e) {
     showToast(e.message || 'Delete failed.', 'error');
   }
 }

function openModal(mount) {
  mount.querySelector('#user-modal-root')?.classList.remove('hidden');
}

function closeModal(mount) {
  mount.querySelector('#user-modal-root')?.classList.add('hidden');
}

// ── Role Permissions Matrix ──────────────────────────────────
async function loadRolePermissions(mount) {
  const wrap = mount.querySelector('#perm-matrix-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="mc-muted p-sp-4">Loading permissions…</div>';

  try {
    const [permRes, capRes] = await Promise.all([
      apiFetch('/role-permissions'),
      apiFetch('/capabilities'),
    ]);

    const roles = permRes.roles || permRes.data || [];
    const capabilities = capRes.capabilities || capRes.data || [];

    if (roles.length === 0) {
      wrap.innerHTML = '<div class="mc-muted p-sp-4">No roles available.</div>';
      return;
    }

    wrap.innerHTML = renderPermissionMatrix(roles, capabilities);
  } catch (e) {
    wrap.innerHTML = '<div class="mc-muted p-sp-4">Failed to load role permissions.</div>';
  }
}

function capabilityLabel(cap) {
  return CAPABILITY_LABELS[cap] || cap;
}

function renderPermissionMatrix(roles, capabilities) {
  const roleCapsLookup = {};
  roles.forEach(r => {
    const caps = r.capabilities || r.caps || [];
    roleCapsLookup[r.id] = Array.isArray(caps) ? caps : (caps || '').split(',').map(c => c.trim()).filter(Boolean);
  });

  const roleCells = roles.map(r => {
    const label = r.label || ROLE_LABELS[r.id] || r.id;
    return `<th>${escapeHTML(label)}</th>`;
  }).join('');

  let body = '';
  CAPABILITY_GROUPS.forEach((group, gi) => {
    const groupClass = gi === 0 ? 'perm-group perm-group--first' : 'perm-group';
    body += `<tr class="${groupClass}"><td colspan="${roles.length + 1}" class="perm-category">${escapeHTML(group.category)}</td></tr>`;
    group.caps.forEach(cap => {
      const rowCells = roles.map(r => {
        const checked = (roleCapsLookup[r.id] || []).includes(cap) ? 'checked' : '';
        return `<td><input type="checkbox" data-role-id="${escapeHTML(r.id)}" data-capability="${escapeHTML(cap)}" ${checked} /></td>`;
      }).join('');
      body += `<tr><td class="role-name">${escapeHTML(capabilityLabel(cap))}</td>${rowCells}</tr>`;
    });
  });

  return `
    <table class="mc-table perm-matrix-table">
      <thead>
        <tr><th class="role-name">Capability</th>${roleCells}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

async function saveRolePermissions(mount) {
  const wrap = mount.querySelector('#perm-matrix-wrap');
  if (!wrap) return;

  const checkboxes = wrap.querySelectorAll('input[type="checkbox"][data-role-id]');
  const byRole = {};
  checkboxes.forEach(cb => {
    const roleId = cb.dataset.roleId;
    if (!byRole[roleId]) byRole[roleId] = [];
    if (cb.checked) byRole[roleId].push(cb.dataset.capability);
  });

  const saveBtn = mount.querySelector('#btn-save-permissions');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    const entries = Object.keys(byRole);
    let saved = 0;
    for (const roleId of entries) {
      await apiFetch(`/role-permissions/${roleId}`, {
        method: 'POST',
        body: JSON.stringify({ capabilities: byRole[roleId] }),
      });
      saved++;
    }
    showToast('Role permissions saved.', 'success');
    // Auto-refresh the audit log to surface the changes
    loadRoleAudit(mount).then(() => { _auditLoaded = true; });
  } catch (e) {
    showToast(e.message || 'Failed to save permissions.', 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
  }
}

// ── Role Audit Log ────────────────────────────────────────────
async function loadRoleAudit(mount) {
  const wrap = mount.querySelector('#audit-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<tr><td colspan="5" class="mc-muted">Loading audit log…</td></tr>';

  try {
    const data = await apiFetch('/role-audit');
    const entries = data.entries || data.audit || data.data || [];
    if (entries.length === 0) {
      wrap.innerHTML = '<tr><td colspan="5" class="mc-muted">No audit entries found.</td></tr>';
      return;
    }
    wrap.innerHTML = renderAuditTable(entries);
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="5" class="mc-muted">Failed to load audit log.</td></tr>';
  }
}

function renderAuditTable(entries) {
  return entries.map(e => {
    const roleLabel = ROLE_LABELS[e.role] || e.role_label || e.role || '—';
    const action = (e.action || '').toLowerCase();
    const actionBadge = action === 'granted'
      ? '<span class="badge badge-success audit-action">Granted</span>'
      : action === 'revoked'
        ? '<span class="badge badge-danger audit-action">Revoked</span>'
        : `<span class="badge badge-neutral audit-action">${escapeHTML(e.action || '—')}</span>`;
    const date = e.date || e.created_at || e.timestamp || '—';
    const performedBy = e.performed_by || e.performedBy || e.actor || '—';
    return `
      <tr>
        <td>${escapeHTML(formatDate(date))}</td>
        <td>${escapeHTML(roleLabel)}</td>
        <td>${escapeHTML(e.capability || e.capability_key || '—')}</td>
        <td>${actionBadge}</td>
        <td>${escapeHTML(performedBy)}</td>
      </tr>`;
  }).join('');
}
