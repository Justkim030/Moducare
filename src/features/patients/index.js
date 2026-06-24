import { showToast, escapeHTML } from '../../../js/utils.js';

export async function init(mount) {
  mount.querySelector('#btn-new-patient')?.addEventListener('click', () => openCreateModal(mount));
  mount.querySelector('#modal-close')?.addEventListener('click', () => closeModal(mount));
  mount.querySelector('#patient-search')?.addEventListener('input', (e) => renderTable(mount, e.target.value));
  mount.querySelector('#patient-modal-root')?.addEventListener('click', (e) => {
    if (e.target.id === 'patient-modal-root') closeModal(mount);
  });

  await renderTable(mount);
}

async function renderTable(mount, query = '') {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  const body = mount.querySelector('#patient-table-body');
  const empty = mount.querySelector('#patient-empty');
  const count = mount.querySelector('#patient-count');

  try {
    const res = await fetch(`/api/patients${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');

    const patients = data.patients || [];
    if (count) count.textContent = `${patients.length} patient${patients.length === 1 ? '' : 's'}`;

    if (patients.length === 0) {
      body.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    body.innerHTML = patients.map(p => `
      <tr>
        <td class="font-mono text-sm">${p.id}</td>
        <td class="font-weight-500">${escapeHTML(p.name)}</td>
        <td class="text-secondary">${p.email || '—'}</td>
        <td class="text-secondary">${p.phone_number || '—'}</td>
        <td><span class="badge badge-neutral">${p.appointment_count}</span></td>
        <td class="text-right">
          <button class="mc-btn mc-btn--sm" data-action="view" data-id="${p.id}">View</button>
          <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${p.id}">Edit</button>
          <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-action="view"]').forEach(b => b.addEventListener('click', () => openViewModal(mount, b.dataset.id)));
    body.querySelectorAll('[data-action="edit"]').forEach(b => b.addEventListener('click', () => openEditModal(mount, b.dataset.id)));
    body.querySelectorAll('[data-action="delete"]').forEach(b => b.addEventListener('click', () => deletePatient(mount, b.dataset.id)));
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="mc-muted">Failed to load patients.</td></tr>`;
  }
}

async function openCreateModal(mount) {
  const title = mount.querySelector('#modal-title');
  const body = mount.querySelector('#modal-body');
  title.textContent = 'Register Patient';
  body.innerHTML = `
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Full Name *</label>
        <input id="p-name" class="input" placeholder="e.g. Jane Doe" />
        <span class="ir-field-error" id="err-name"></span>
      </div>
      <div class="input-group">
        <label class="input-label">Phone</label>
        <input id="p-phone" class="input" placeholder="+254..." />
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Email</label>
      <input id="p-email" class="input" type="email" placeholder="patient@example.org" />
    </div>
    <div class="flex justify-between mt-sp-4">
      <button class="mc-btn" id="modal-cancel">Cancel</button>
      <button class="mc-btn btn-primary" id="modal-save">Save Patient</button>
    </div>
  `;

  mount.querySelector('#modal-cancel').addEventListener('click', () => closeModal(mount));
  mount.querySelector('#modal-save').addEventListener('click', () => createPatient(mount));
  openModal(mount);
}

async function openEditModal(mount, id) {
  const title = mount.querySelector('#modal-title');
  const body = mount.querySelector('#modal-body');
  let patient = null;
  try {
    const res = await fetch(`/api/patients/${id}`);
    const data = await res.json();
    if (res.ok && data.ok) patient = data.patient;
  } catch (e) { patient = null; }

  if (!patient) {
    showToast('Patient not found.', 'warning');
    return;
  }

  title.textContent = 'Edit Patient';
  body.innerHTML = `
    <div class="input-group">
      <label class="input-label">Full Name *</label>
      <input id="p-name" class="input" value="${patient.name || ''}" />
      <span class="ir-field-error" id="err-name"></span>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Email</label>
        <input id="p-email" class="input" type="email" value="${patient.email || ''}" />
      </div>
      <div class="input-group">
        <label class="input-label">Phone</label>
        <input id="p-phone" class="input" value="${patient.phone_number || ''}" />
      </div>
    </div>
    <div class="flex justify-between mt-sp-4">
      <button class="mc-btn" id="modal-cancel">Cancel</button>
      <button class="mc-btn btn-primary" id="modal-save">Update Patient</button>
    </div>
  `;

  mount.querySelector('#modal-cancel').addEventListener('click', () => closeModal(mount));
  mount.querySelector('#modal-save').addEventListener('click', () => updatePatient(mount, id));
  openModal(mount);
}

async function openViewModal(mount, id) {
  const title = mount.querySelector('#modal-title');
  const body = mount.querySelector('#modal-body');
  let patient = null;
  try {
    const res = await fetch(`/api/patients/${id}`);
    const data = await res.json();
    if (res.ok && data.ok) patient = data.patient;
  } catch (e) { patient = null; }

  if (!patient) {
    showToast('Patient not found.', 'warning');
    return;
  }

  title.textContent = 'Patient Detail';
  body.innerHTML = `
    <div class="ir-detail-grid">
      <div><span class="ir-detail-label">ID</span><span>${patient.id}</span></div>
      <div><span class="ir-detail-label">Name</span><span>${escapeHTML(patient.name)}</span></div>
      <div><span class="ir-detail-label">Email</span><span>${patient.email || '—'}</span></div>
      <div><span class="ir-detail-label">Phone</span><span>${patient.phone_number || '—'}</span></div>
      <div><span class="ir-detail-label">Last Appointment</span><span>${patient.time ? new Date(patient.time).toLocaleString() : '—'}</span></div>
      <div><span class="ir-detail-label">Type</span><span>${patient.type || '—'}</span></div>
      <div><span class="ir-detail-label">Status</span><span>${patient.status || '—'}</span></div>
      <div><span class="ir-detail-label">Doctor</span><span>${patient.doctor || '—'}</span></div>
    </div>
    <div class="flex justify-end mt-sp-4">
      <button class="mc-btn" id="modal-close-btn">Close</button>
    </div>
  `;

  mount.querySelector('#modal-close-btn').addEventListener('click', () => closeModal(mount));
  openModal(mount);
}

async function createPatient(mount) {
  const name = mount.querySelector('#p-name')?.value.trim();
  const email = mount.querySelector('#p-email')?.value.trim();
  const phone = mount.querySelector('#p-phone')?.value.trim();
  const err = mount.querySelector('#err-name');

  if (!name) {
    if (err) err.textContent = 'Name is required.';
    return;
  }
  if (err) err.textContent = '';

  try {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone_number: phone })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');
    showToast('Patient registered successfully.', 'success');
    closeModal(mount);
    renderTable(mount, mount.querySelector('#patient-search')?.value || '');
  } catch (e) {
    showToast(e.message || 'Register failed.', 'error');
  }
}

async function updatePatient(mount, id) {
  const name = mount.querySelector('#p-name')?.value.trim();
  const email = mount.querySelector('#p-email')?.value.trim();
  const phone = mount.querySelector('#p-phone')?.value.trim();
  const err = mount.querySelector('#err-name');

  if (!name) {
    if (err) err.textContent = 'Name is required.';
    return;
  }
  if (err) err.textContent = '';

  try {
    const res = await fetch(`/api/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone_number: phone })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');
    showToast('Patient updated.', 'success');
    closeModal(mount);
    renderTable(mount, mount.querySelector('#patient-search')?.value || '');
  } catch (e) {
    showToast(e.message || 'Update failed.', 'error');
  }
}

async function deletePatient(mount, id) {
  if (!confirm('Delete this patient record? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');
    showToast('Patient deleted.', 'success');
    renderTable(mount, mount.querySelector('#patient-search')?.value || '');
  } catch (e) {
    showToast(e.message || 'Delete failed.', 'error');
  }
}

function openModal(mount) {
  mount.querySelector('#patient-modal-root')?.classList.remove('hidden');
}
function closeModal(mount) {
  mount.querySelector('#patient-modal-root')?.classList.add('hidden');
}
