import { showToast, escapeHTML, apiFetch } from '../../../js/utils.js';

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
     const data = await apiFetch('/patients');
     if (!data.ok) throw new Error(data?.error || 'Failed');

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
        <td><span class="badge badge-neutral">${p.gender || 'N/A'}</span></td>
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
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Email</label>
        <input id="p-email" class="input" type="email" placeholder="patient@example.org" />
      </div>
      <div class="input-group">
        <label class="input-label">Date of Birth</label>
        <input id="p-dob" class="input" type="date" />
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Gender</label>
        <select id="p-gender" class="input">
          <option value="">-- Select --</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">County</label>
        <input id="p-county" class="input" placeholder="e.g. Uasin Gishu" />
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Address</label>
      <textarea id="p-address" class="input" rows="2" placeholder="Physical address..."></textarea>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Next of Kin</label>
        <input id="p-nok" class="input" placeholder="Name" />
      </div>
      <div class="input-group">
        <label class="input-label">NOK Phone</label>
        <input id="p-nok-phone" class="input" placeholder="+254..." />
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">AMPMH ID</label>
        <input id="p-ampmh" class="input" placeholder="AMP-001" />
      </div>
      <div class="input-group">
        <label class="input-label">National ID</label>
        <input id="p-national" class="input" placeholder="12345678" />
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Insurance ID</label>
        <input id="p-insurance" class="input" placeholder="NHIF-001" />
      </div>
      <div class="input-group">
        <label class="input-label">HIV Status</label>
        <select id="p-hiv" class="input">
          <option value="unknown">Unknown</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </div>
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
    const data = await apiFetch(`/patients/${id}`);
    if (!data.ok) throw new Error(data?.error || 'Failed');
    patient = data.patient;
  } catch (e) { patient = null; }

  if (!patient) {
    showToast('Patient not found.', 'warning');
    return;
  }

  title.textContent = 'Edit Patient';
  const p = patient;
  body.innerHTML = `
    <div class="input-group">
      <label class="input-label">Full Name *</label>
      <input id="p-name" class="input" value="${escapeHTML(p.name || '')}" />
      <span class="ir-field-error" id="err-name"></span>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Email</label>
        <input id="p-email" class="input" type="email" value="${escapeHTML(p.email || '')}" />
      </div>
      <div class="input-group">
        <label class="input-label">Phone</label>
        <input id="p-phone" class="input" value="${escapeHTML(p.phone_number || '')}" />
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Date of Birth</label>
        <input id="p-dob" class="input" type="date" value="${p.dob || ''}" />
      </div>
      <div class="input-group">
        <label class="input-label">Gender</label>
        <select id="p-gender" class="input">
          <option value="">-- Select --</option>
          <option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option>
          <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
          <option value="Other" ${p.gender === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Address</label>
      <textarea id="p-address" class="input" rows="2">${escapeHTML(p.address || '')}</textarea>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">County</label>
        <input id="p-county" class="input" value="${escapeHTML(p.county || '')}" />
      </div>
      <div class="input-group">
        <label class="input-label">HIV Status</label>
        <select id="p-hiv" class="input">
          <option value="unknown" ${p.hiv_status === 'unknown' ? 'selected' : ''}>Unknown</option>
          <option value="positive" ${p.hiv_status === 'positive' ? 'selected' : ''}>Positive</option>
          <option value="negative" ${p.hiv_status === 'negative' ? 'selected' : ''}>Negative</option>
        </select>
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">Next of Kin</label>
        <input id="p-nok" class="input" value="${escapeHTML(p.next_of_kin || '')}" />
      </div>
      <div class="input-group">
        <label class="input-label">NOK Phone</label>
        <input id="p-nok-phone" class="input" value="${escapeHTML(p.next_of_kin_phone || '')}" />
      </div>
    </div>
    <div class="form-row-2">
      <div class="input-group">
        <label class="input-label">AMPMH ID</label>
        <input id="p-ampmh" class="input" value="${escapeHTML(p.ampkh_id || '')}" />
      </div>
      <div class="input-group">
        <label class="input-label">National ID</label>
        <input id="p-national" class="input" value="${escapeHTML(p.national_id || '')}" />
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Insurance ID</label>
      <input id="p-insurance" class="input" value="${escapeHTML(p.insurance_id || '')}" />
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
    const data = await apiFetch(`/patients/${id}`);
    if (!data.ok) throw new Error(data?.error || 'Failed');
    patient = data.patient;
  } catch (e) { patient = null; }

  if (!patient) {
    showToast('Patient not found.', 'warning');
    return;
  }

  title.textContent = 'Patient Detail';
  const p = patient;
  body.innerHTML = `
    <div class="ir-detail-grid">
      <div><span class="ir-detail-label">ID</span><span>${p.id}</span></div>
      <div><span class="ir-detail-label">Name</span><span>${escapeHTML(p.name)}</span></div>
      <div><span class="ir-detail-label">Email</span><span>${p.email || '—'}</span></div>
      <div><span class="ir-detail-label">Phone</span><span>${p.phone_number || '—'}</span></div>
      <div><span class="ir-detail-label">DOB</span><span>${p.dob || '—'}</span></div>
      <div><span class="ir-detail-label">Gender</span><span>${p.gender || '—'}</span></div>
      <div><span class="ir-detail-label">County</span><span>${p.county || '—'}</span></div>
      <div><span class="ir-detail-label">HIV Status</span><span>${p.hiv_status || '—'}</span></div>
      <div><span class="ir-detail-label">Address</span><span>${p.address || '—'}</span></div>
      <div><span class="ir-detail-label">Next of Kin</span><span>${p.next_of_kin || '—'}</span></div>
      <div><span class="ir-detail-label">NOK Phone</span><span>${p.next_of_kin_phone || '—'}</span></div>
      <div><span class="ir-detail-label">AMPMH ID</span><span>${p.ampkh_id || '—'}</span></div>
      <div><span class="ir-detail-label">National ID</span><span>${p.national_id || '—'}</span></div>
      <div><span class="ir-detail-label">Insurance</span><span>${p.insurance_id || '—'}</span></div>
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
    const payload = {
      name,
      email,
      phone_number: phone,
      dob: mount.querySelector('#p-dob')?.value || '',
      gender: mount.querySelector('#p-gender')?.value || '',
      address: mount.querySelector('#p-address')?.value || '',
      county: mount.querySelector('#p-county')?.value || '',
      next_of_kin: mount.querySelector('#p-nok')?.value || '',
      next_of_kin_phone: mount.querySelector('#p-nok-phone')?.value || '',
      ampkh_id: mount.querySelector('#p-ampmh')?.value || '',
      national_id: mount.querySelector('#p-national')?.value || '',
      insurance_id: mount.querySelector('#p-insurance')?.value || '',
      hiv_status: mount.querySelector('#p-hiv')?.value || 'unknown',
    };
    const data = await apiFetch('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!data.ok) throw new Error(data?.error || 'Failed');
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
    const payload = {
      name,
      email,
      phone_number: phone,
      dob: mount.querySelector('#p-dob')?.value || '',
      gender: mount.querySelector('#p-gender')?.value || '',
      address: mount.querySelector('#p-address')?.value || '',
      county: mount.querySelector('#p-county')?.value || '',
      next_of_kin: mount.querySelector('#p-nok')?.value || '',
      next_of_kin_phone: mount.querySelector('#p-nok-phone')?.value || '',
      ampkh_id: mount.querySelector('#p-ampmh')?.value || '',
      national_id: mount.querySelector('#p-national')?.value || '',
      insurance_id: mount.querySelector('#p-insurance')?.value || '',
      hiv_status: mount.querySelector('#p-hiv')?.value || 'unknown',
    };
    const data = await apiFetch(`/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!data.ok) throw new Error(data?.error || 'Failed');
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
    const data = await apiFetch(`/patients/${id}`, { method: 'DELETE' });
    if (!data.ok) throw new Error(data?.error || 'Failed');
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
