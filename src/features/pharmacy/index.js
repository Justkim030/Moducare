/**
 * ModuCare MS — Pharmacy / ART Dispensing Module
 * Features: ART dispensing, inventory tracking, adherence counseling
 */
import { showToast, formatDate, escapeHTML, apiFetch, extractList, buildPaginationHTML, attachPagination } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let pharmPage = 1;
const PHARM_PAGE_SIZE = 25;
let pharmTotal = 0;
let pharmTotalPages = 1;
let editingPharmId = null;

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
l.rel = 'stylesheet';
   l.href = '/src/features/pharmacy/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshList(container);
}

export async function init(container, State) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

function buildShell() {
  return `
  <div class="pharmacy-layout">
    <div class="pharmacy-header">
      <h1>💊 Pharmacy / ART Dispensing</h1>
      <button class="mc-btn btn-primary" id="new-dispense-btn">+ New Dispensing</button>
    </div>
    <div class="pharmacy-filters">
      <select id="pharm-filter-regimen" class="input" style="width:auto;">
        <option value="">All Regimen Types</option>
        <option value="ART">ART</option>
        <option value="OI Prophylaxis">OI Prophylaxis</option>
        <option value="Other">Other</option>
      </select>
      <select id="pharm-filter-patient" class="input" style="width:auto;">
        <option value="">All Patients</option>
      </select>
    </div>
    <div id="pharm-list"></div>

    <div id="pharm-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 700px;">
        <div class="modal-header">
          <h2>New Dispensing Record</h2>
          <button class="modal-close" id="close-pharm-modal">&times;</button>
        </div>
        <form id="pharm-form" class="pharm-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="pharm-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Drug Name *</label>
              <input type="text" id="pharm-drug" class="input" required placeholder="e.g. Dolutegravir/Lamivudine/Tenofovir">
            </div>
            <div class="input-group">
              <label class="input-label">Drug Code</label>
              <input type="text" id="pharm-code" class="input" placeholder="e.g. TLD">
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Dosage</label>
              <input type="text" id="pharm-dosage" class="input" placeholder="e.g. 1 tablet">
            </div>
            <div class="input-group">
              <label class="input-label">Frequency</label>
              <input type="text" id="pharm-freq" class="input" placeholder="e.g. Once daily">
            </div>
            <div class="input-group">
              <label class="input-label">Duration (days)</label>
              <input type="number" id="pharm-duration" class="input" placeholder="30">
            </div>
            <div class="input-group">
              <label class="input-label">Quantity</label>
              <input type="number" id="pharm-qty" class="input" placeholder="30">
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Regimen Type</label>
              <select id="pharm-regimen" class="input">
                <option value="ART">ART</option>
                <option value="OI Prophylaxis">OI Prophylaxis</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Adherence Counseled</label>
              <select id="pharm-counseled" class="input">
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Notes</label>
            <textarea id="pharm-notes" class="input" rows="2"></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-pharm">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Save Dispensing</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#pharm-list');
  if (!list) return;
  const regimen = container.querySelector('#pharm-filter-regimen').value || '';
  const patientId = container.querySelector('#pharm-filter-patient').value || '';
  const qs = new URLSearchParams();
  qs.set('page', pharmPage);
  qs.set('limit', PHARM_PAGE_SIZE);
  if (regimen) qs.set('regimen_type', regimen);
  if (patientId) qs.set('patient_id', patientId);

  let data;
  try {
    data = await apiFetch(`/pharmacy?${qs.toString()}`);
  } catch (err) {
    showToast(err.message || 'Failed to load dispensing records', 'error');
    list.innerHTML = `<div class="empty-state"><h3>Failed to load dispensing records</h3></div>`;
    return;
  }

  const records = extractList(data, 'dispensing');
  const pag = data.pagination || {};
  pharmTotal = pag.total || records.length;
  pharmTotalPages = pag.totalPages || 1;
  if (pharmPage > pharmTotalPages) { pharmPage = pharmTotalPages; return refreshList(container); }

  if (records.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No dispensing records</h3><p>Record a new dispensing event.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="pharm-table-wrap">
      <table class="mc-table pharm-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Drug</th>
            <th>Code</th>
            <th>Dosage</th>
            <th>Qty</th>
            <th>Regimen</th>
            <th>Counseled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${formatDate(r.dispensed_date)}</td>
              <td>${escapeHTML(r.patient_name || 'Unknown')}</td>
              <td>${escapeHTML(r.drug_name)}</td>
              <td>${escapeHTML(r.drug_code || '—')}</td>
              <td>${escapeHTML(r.dosage || '—')} / ${escapeHTML(r.frequency || '—')}</td>
              <td>${r.quantity || '—'}</td>
              <td><span class="badge badge-neutral">${escapeHTML(r.regimen_type || '—')}</span></td>
              <td>${r.adherence_counseled ? '✅ Yes' : 'No'}</td>
              <td class="pharm-actions">
                <button class="mc-btn btn-sm btn-ghost pharm-edit" data-id="${escapeHTML(String(r.id))}">Edit</button>
                <button class="mc-btn btn-sm btn-danger pharm-delete" data-id="${escapeHTML(String(r.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${buildPaginationHTML(pharmPage, PHARM_PAGE_SIZE, pharmTotal)}
    </div>`;

  list.querySelectorAll('.pharm-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = records.find(x => String(x.id) === btn.dataset.id);
      if (rec) showEditForm(container, rec);
    });
  });
  list.querySelectorAll('.pharm-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePharm(container, btn.dataset.id));
  });

  attachPagination(list.querySelector('.pagination'), { get page() { return pharmPage; }, set page(v) { pharmPage = v; } }, () => refreshList(container));
}

async function deletePharm(container, id) {
  if (!confirm('Delete this dispensing record?')) return;
  try {
    await apiFetch(`/pharmacy/${id}`, { method: 'DELETE' });
    showToast('Dispensing record deleted', 'success');
    refreshList(container);
  } catch (err) {
    showToast(err.message || 'Failed to delete dispensing record', 'error');
  }
}

async function bindEvents(container) {
  const modal = container.querySelector('#pharm-modal');
  const form = container.querySelector('#pharm-form');

  container.querySelector('#new-dispense-btn').addEventListener('click', async () => {
    editingPharmId = null;
    await populatePatients(container);
    form.reset();
    modal.style.display = 'flex';
  });

  container.querySelector('#close-pharm-modal').addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-pharm').addEventListener('click', () => { modal.style.display = 'none'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#pharm-patient').value,
      drug_name: container.querySelector('#pharm-drug').value,
      drug_code: container.querySelector('#pharm-code').value,
      dosage: container.querySelector('#pharm-dosage').value,
      frequency: container.querySelector('#pharm-freq').value,
      duration_days: parseInt(container.querySelector('#pharm-duration').value) || null,
      quantity: parseInt(container.querySelector('#pharm-qty').value) || null,
      regimen_type: container.querySelector('#pharm-regimen').value,
      adherence_counseled: container.querySelector('#pharm-counseled').value === '1',
      notes: container.querySelector('#pharm-notes').value,
    };
    try {
      if (editingPharmId) {
        await apiFetch(`/pharmacy/${editingPharmId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Dispensing record updated', 'success');
      } else {
        await apiFetch('/pharmacy', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Dispensing recorded', 'success');
      }
      editingPharmId = null;
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to save dispensing', 'error');
    }
  });

  container.querySelector('#pharm-filter-regimen').addEventListener('change', () => { pharmPage = 1; refreshList(container); });
  container.querySelector('#pharm-filter-patient').addEventListener('change', () => { pharmPage = 1; refreshList(container); });
}

async function showEditForm(container, rec) {
  editingPharmId = rec.id;
  const modal = container.querySelector('#pharm-modal');
  const form = container.querySelector('#pharm-form');
  if (!modal || !form) return;
  await populatePatients(container);
  const set = (id, val) => { const el = form.querySelector(`#${id}`); if (el && val !== undefined && val !== null) el.value = val; };
  set('pharm-patient', rec.patient_id);
  set('pharm-drug', rec.drug_name);
  set('pharm-code', rec.drug_code);
  set('pharm-dosage', rec.dosage);
  set('pharm-freq', rec.frequency);
  set('pharm-duration', rec.duration_days);
  set('pharm-qty', rec.quantity);
  set('pharm-regimen', rec.regimen_type);
  set('pharm-counseled', rec.adherence_counseled ? '1' : '0');
  set('pharm-notes', rec.notes);
  modal.style.display = 'flex';
}

async function populatePatients(container) {
  const select = container.querySelector('#pharm-patient');
  if (!select) return;
  const filterSelect = container.querySelector('#pharm-filter-patient');
  try {
    const data = await apiFetch('/patients');
    const patients = data.patients || [];
    const opts = patients.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.email || 'no email')})</option>`).join('');
    select.innerHTML = '<option value="">-- Select Patient --</option>' + opts;
    if (filterSelect) filterSelect.innerHTML = '<option value="">All Patients</option>' + opts;
  } catch {
    showToast('Failed to load patients', 'error');
  }
}
