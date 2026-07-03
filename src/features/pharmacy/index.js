/**
 * ModuCare MS — Pharmacy / ART Dispensing Module
 * Features: ART dispensing, inventory tracking, adherence counseling
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

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
  const regimen = container.querySelector('#pharm-filter-regimen')?.value || '';
  const qs = regimen ? `?regimen_type=${encodeURIComponent(regimen)}` : '';
  const data = await apiFetch(`/pharmacy${qs}`);
  const records = data.dispensing || [];
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
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

async function bindEvents(container) {
  const modal = container.querySelector('#pharm-modal');
  const form = container.querySelector('#pharm-form');

  container.querySelector('#new-dispense-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-pharm-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-pharm')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#pharm-patient')?.value,
      drug_name: container.querySelector('#pharm-drug')?.value,
      drug_code: container.querySelector('#pharm-code')?.value,
      dosage: container.querySelector('#pharm-dosage')?.value,
      frequency: container.querySelector('#pharm-freq')?.value,
      duration_days: parseInt(container.querySelector('#pharm-duration')?.value) || null,
      quantity: parseInt(container.querySelector('#pharm-qty')?.value) || null,
      regimen_type: container.querySelector('#pharm-regimen')?.value,
      adherence_counseled: container.querySelector('#pharm-counseled')?.value === '1',
      notes: container.querySelector('#pharm-notes')?.value,
    };
    try {
      await apiFetch('/pharmacy', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Dispensing recorded', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to save dispensing', 'error');
    }
  });

  container.querySelector('#pharm-filter-regimen')?.addEventListener('change', () => refreshList(container));
}

async function populatePatients(container) {
  const select = container.querySelector('#pharm-patient');
  if (!select) return;
  try {
    const data = await apiFetch('/patients');
    const patients = data.patients || [];
    select.innerHTML = '<option value="">-- Select Patient --</option>' +
      patients.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.email || 'no email')})</option>`).join('');
  } catch {
    showToast('Failed to load patients', 'error');
  }
}
