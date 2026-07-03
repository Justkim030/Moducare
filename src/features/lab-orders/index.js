/**
 * ModuCare MS — Lab Orders & Results Module
 * Features: Order entry, result entry, abnormal flagging, status tracking
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
l.rel = 'stylesheet';
   l.href = '/src/features/lab-orders/styles.css';
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
  <div class="lab-orders-layout">
    <div class="lab-orders-header">
      <h1>🔬 Lab Orders & Results</h1>
      <button class="mc-btn btn-primary" id="new-lab-btn">+ New Lab Order</button>
    </div>
    <div class="lab-filters">
      <select id="lab-filter-status" class="input" style="width:auto;">
        <option value="">All Status</option>
        <option value="ordered">Ordered</option>
        <option value="collected">Collected</option>
        <option value="processing">Processing</option>
        <option value="resulted">Resulted</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select id="lab-filter-type" class="input" style="width:auto;">
        <option value="">All Types</option>
        <option value="HIV">HIV</option>
        <option value="Hematology">Hematology</option>
        <option value="Chemistry">Chemistry</option>
        <option value="Microbiology">Microbiology</option>
        <option value="Urinalysis">Urinalysis</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div id="lab-list"></div>

    <div id="lab-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 700px;">
        <div class="modal-header">
          <h2 id="lab-modal-title">New Lab Order</h2>
          <button class="modal-close" id="close-lab-modal">&times;</button>
        </div>
        <form id="lab-form" class="lab-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="lab-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Test Type *</label>
              <select id="lab-test-type" class="input" required>
                <option value="HIV">HIV</option>
                <option value="Hematology">Hematology</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Urinalysis">Urinalysis</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Test Name</label>
              <input type="text" id="lab-test-name" class="input" placeholder="e.g. Viral Load, CD4, Creatinine">
            </div>
          </div>

          <div class="form-section">
            <h3>Results</h3>
            <div class="form-row">
              <div class="input-group">
                <label class="input-label">Result Value</label>
                <input type="text" id="lab-result-value" class="input" placeholder="e.g. < 40, 450">
              </div>
              <div class="input-group">
                <label class="input-label">Unit</label>
                <input type="text" id="lab-result-unit" class="input" placeholder="e.g. copies/mL, cells/uL">
              </div>
              <div class="input-group">
                <label class="input-label">Reference Range</label>
                <input type="text" id="lab-ref-range" class="input" placeholder="e.g. < 50">
              </div>
              <div class="input-group">
                <label class="input-label">Abnormal Flag</label>
                <select id="lab-flag" class="input">
                  <option value="">--</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">Notes</label>
            <textarea id="lab-notes" class="input" rows="2"></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-lab">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Save Lab Order</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#lab-list');
  if (!list) return;
  const status = container.querySelector('#lab-filter-status')?.value || '';
  const testType = container.querySelector('#lab-filter-type')?.value || '';
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (testType) qs.set('test_type', testType);
  const qsStr = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiFetch(`/lab-orders${qsStr}`);
  const orders = data.labOrders || [];
  if (orders.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No lab orders found</h3><p>Create a new lab order to get started.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="lab-table-wrap">
      <table class="mc-table lab-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Test Type</th>
            <th>Test Name</th>
            <th>Status</th>
            <th>Result</th>
            <th>Flag</th>
            <th>Provider</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>${formatDate(o.result_date || o.id)}</td>
              <td>${escapeHTML(o.patient_name || 'Unknown')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(o.test_type)}</span></td>
              <td>${escapeHTML(o.test_name || '—')}</td>
              <td>${renderStatus(o.status)}</td>
              <td>${escapeHTML(o.result_value || '—')} ${escapeHTML(o.result_unit || '')}</td>
              <td>${renderFlag(o.abnormal_flag)}</td>
              <td>${escapeHTML(o.provider_name || 'Unassigned')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderStatus(s) {
  const map = { ordered: 'badge-neutral', collected: 'badge-info', processing: 'badge-warning', resulted: 'badge-success', cancelled: 'badge-danger' };
  return `<span class="badge ${map[s] || 'badge-neutral'}">${escapeHTML(s || 'N/A')}</span>`;
}

function renderFlag(f) {
  if (!f) return '<span class="muted">—</span>';
  const map = { Normal: 'badge-success', High: 'badge-warning', Low: 'badge-warning', Critical: 'badge-danger' };
  return `<span class="badge ${map[f] || 'badge-neutral'}">${escapeHTML(f)}</span>`;
}

async function bindEvents(container) {
  const modal = container.querySelector('#lab-modal');
  const form = container.querySelector('#lab-form');

  container.querySelector('#new-lab-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-lab-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-lab')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#lab-patient')?.value,
      test_type: container.querySelector('#lab-test-type')?.value,
      test_name: container.querySelector('#lab-test-name')?.value,
      status: 'ordered',
      result_value: container.querySelector('#lab-result-value')?.value,
      result_unit: container.querySelector('#lab-result-unit')?.value,
      reference_range: container.querySelector('#lab-ref-range')?.value,
      abnormal_flag: container.querySelector('#lab-flag')?.value,
      result_date: new Date().toISOString(),
      notes: container.querySelector('#lab-notes')?.value,
    };
    try {
      await apiFetch('/lab-orders', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Lab order created', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to create lab order', 'error');
    }
  });

  container.querySelector('#lab-filter-status')?.addEventListener('change', () => refreshList(container));
  container.querySelector('#lab-filter-type')?.addEventListener('change', () => refreshList(container));
}

async function populatePatients(container) {
  const select = container.querySelector('#lab-patient');
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
