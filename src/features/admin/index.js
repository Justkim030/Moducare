import { showToast, escapeHTML, apiFetch } from '../../../js/utils.js';

const ROLE_LABELS = {
  role_admin: 'System Administrator',
  role_dev: 'Front-Desk / Intake',
  role_nurse: 'Clinical Staff / Triage',
  role_lead: 'Healthcare Provider',
  role_supervisor: 'M&E Officer',
  role_director: 'M&E Director',
  role_finance: 'Ancillary Services',
};

export async function init(mount, State) {
  mount.querySelector('#btn-new-user')?.addEventListener('click', () => openCreateModal(mount));
  mount.querySelector('#modal-close')?.addEventListener('click', () => closeModal(mount));
  mount.querySelector('#user-modal-root')?.addEventListener('click', (e) => {
    if (e.target.id === 'user-modal-root') closeModal(mount);
  });

  await loadUsers(mount);
}

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
          <td class="name font-weight-500">${u.name || '—'}</td>
          <td class="email text-secondary">${escapeHTML(u.email)}</td>
          <td><span class="badge badge-primary">${ROLE_LABELS[u.role] || u.role || 'staff'}</span></td>
          <td class="text-secondary">${u.phone_number || '—'}</td>
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
      <input id="u-name" class="input" value="${user.name || ''}" />
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Email</label>
        <input id="u-email" class="input" type="email" value="${user.email || ''}" />
      </div>
      <div class="input-group">
        <label class="input-label">Phone</label>
        <input id="u-phone" class="input" value="${user.phone_number || ''}" />
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
