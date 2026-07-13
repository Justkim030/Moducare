/**
 * ModuCare MS — Clinical Encounters Module
 * Features: Encounter list, vitals capture, diagnoses, SOAP notes,
 *           HIV-specific fields (viral load, CD4, ART regimen/adherence)
 */
import { showToast, formatDate, escapeHTML, apiFetch, extractList, buildPaginationHTML, attachPagination } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let encPage = 1;
const ENC_PAGE_SIZE = 25;
let encTotal = 0;
let encTotalPages = 1;
let editingEncId = null;

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/encounters/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

function render(container) {
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
  <div class="encounters-layout">
    <div class="encounters-header">
      <h1>🩺 Clinical Encounters</h1>
      <button class="mc-btn btn-primary" id="new-encounter-btn">+ New Encounter</button>
    </div>

    <div class="encounters-filters">
      <select id="enc-filter-patient" class="input" style="width:auto;">
        <option value="">All Patients</option>
      </select>
    </div>

    <div id="encounter-list"></div>

    <div id="encounter-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h2>New Clinical Encounter</h2>
          <button class="modal-close" id="close-modal">&times;</button>
        </div>
        <form id="encounter-form" class="encounter-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="enc-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Visit Type</label>
              <select id="enc-visit" class="input">
                <option value="Outpatient">Outpatient</option>
                <option value="Inpatient">Inpatient</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Emergency">Emergency</option>
                <option value="Home Visit">Home Visit</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Provider</label>
              <select id="enc-provider" class="input">
                <option value="">-- Select Provider --</option>
              </select>
            </div>
          </div>

          <div class="form-section">
            <h3>Vitals</h3>
            <div class="form-row form-row-4">
              <div class="input-group"><label class="input-label">BP (mmHg)</label><input type="text" id="enc-bp" class="input" placeholder="120/80"></div>
              <div class="input-group"><label class="input-label">Temp (°C)</label><input type="number" step="0.1" id="enc-temp" class="input" placeholder="36.5"></div>
              <div class="input-group"><label class="input-label">Weight (kg)</label><input type="number" step="0.1" id="enc-weight" class="input" placeholder="65"></div>
              <div class="input-group"><label class="input-label">Pulse (/min)</label><input type="number" id="enc-pulse" class="input" placeholder="72"></div>
            </div>
            <div class="form-row form-row-4">
              <div class="input-group"><label class="input-label">Resp Rate</label><input type="number" id="enc-rr" class="input" placeholder="16"></div>
              <div class="input-group"><label class="input-label">SpO2 (%)</label><input type="number" id="enc-spo2" class="input" placeholder="98"></div>
              <div class="input-group"><label class="input-label">Height (cm)</label><input type="number" step="0.1" id="enc-height" class="input" placeholder="170"></div>
              <div class="input-group"><label class="input-label">BMI</label><input type="text" id="enc-bmi" class="input" placeholder="Auto" readonly></div>
            </div>
          </div>

          <div class="form-section">
            <h3>Clinical Notes</h3>
            <div class="input-group">
              <label class="input-label">Chief Complaint</label>
              <textarea id="enc-complaint" class="input" rows="2" placeholder="Reason for visit..."></textarea>
            </div>
            <div class="input-group">
              <label class="input-label">Diagnoses</label>
              <textarea id="enc-diagnoses" class="input" rows="2" placeholder="One per line, e.g.&#10;HIV/AIDS&#10;Hypertension"></textarea>
            </div>
            <div class="input-group">
              <label class="input-label">SOAP Notes</label>
              <textarea id="enc-soap" class="input" rows="3" placeholder="Subjective, Objective, Assessment, Plan..."></textarea>
            </div>
            <div class="input-group">
              <label class="input-label">Follow-up Plan</label>
              <textarea id="enc-followup" class="input" rows="2" placeholder="Next appointment, referrals, tests..."></textarea>
            </div>
          </div>

          <div class="form-section">
            <h3>HIV / Chronic Disease Tracking</h3>
            <div class="form-row form-row-3">
              <div class="input-group">
                <label class="input-label">Viral Load (copies/mL)</label>
                <input type="text" id="enc-vl" class="input" placeholder="e.g. < 40">
              </div>
              <div class="input-group">
                <label class="input-label">CD4 Count (cells/μL)</label>
                <input type="number" id="enc-cd4" class="input" placeholder="e.g. 450">
              </div>
              <div class="input-group">
                <label class="input-label">ART Regimen</label>
                <input type="text" id="enc-art" class="input" placeholder="e.g. TLD/3TC">
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">ART Adherence</label>
              <select id="enc-adherence" class="input">
                <option value="">-- Select --</option>
                <option value="Good">Good (>95%)</option>
                <option value="Fair">Fair (80-95%)</option>
                <option value="Poor">Poor (<80%)</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-encounter">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Save Encounter</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#encounter-list');
  if (!list) return;
  const patientId = container.querySelector('#enc-filter-patient').value || '';
  const qs = new URLSearchParams();
  qs.set('page', encPage);
  qs.set('limit', ENC_PAGE_SIZE);
  if (patientId) qs.set('patient_id', patientId);

  let data;
  try {
    data = await apiFetch(`/encounters?${qs.toString()}`);
  } catch (err) {
    showToast(err.message || 'Failed to load encounters', 'error');
    list.innerHTML = `<div class="empty-state"><h3>Failed to load encounters</h3></div>`;
    return;
  }

  const encounters = extractList(data, 'encounters');
  const pag = data.pagination || {};
  encTotal = pag.total || encounters.length;
  encTotalPages = pag.totalPages || 1;
  if (encPage > encTotalPages) { encPage = encTotalPages; return refreshList(container); }

  if (encounters.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No encounters recorded</h3><p>Start by creating a new clinical encounter.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="encounters-table-wrap">
      <table class="mc-table encounters-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Visit Type</th>
            <th>Provider</th>
            <th>Chief Complaint</th>
            <th>Vitals</th>
            <th>Diagnoses</th>
            <th>HIV Status</th>
            <th>ART</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${encounters.map(e => `
            <tr>
              <td>${formatDate(e.encounter_date)}</td>
              <td>${escapeHTML(e.patient_name || 'Unknown')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(e.visit_type || 'N/A')}</span></td>
              <td>${escapeHTML(e.provider_name || 'Unassigned')}</td>
              <td>${escapeHTML(e.chief_complaint || '—')}</td>
              <td>${renderVitals(e.vitals)}</td>
              <td>${renderDiagnoses(e.diagnoses)}</td>
              <td>${renderHIV(e)}</td>
              <td>${escapeHTML(e.art_regimen || '—')}</td>
              <td class="enc-actions">
                <button class="mc-btn btn-sm btn-ghost enc-edit" data-id="${escapeHTML(String(e.id))}">Edit</button>
                <button class="mc-btn btn-sm btn-danger enc-delete" data-id="${escapeHTML(String(e.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${buildPaginationHTML(encPage, ENC_PAGE_SIZE, encTotal)}
    </div>`;

  list.querySelectorAll('.enc-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const enc = encounters.find(x => String(x.id) === btn.dataset.id);
      if (enc) showEditForm(container, enc);
    });
  });
  list.querySelectorAll('.enc-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteEnc(container, btn.dataset.id));
  });

  attachPagination(list.querySelector('.pagination'), { get page() { return encPage; }, set page(v) { encPage = v; } }, () => refreshList(container));
}

async function deleteEnc(container, id) {
  if (!confirm('Delete this encounter?')) return;
  try {
    await apiFetch(`/encounters/${id}`, { method: 'DELETE' });
    showToast('Encounter deleted', 'success');
    refreshList(container);
  } catch (err) {
    showToast(err.message || 'Failed to delete encounter', 'error');
  }
}

function renderVitals(v) {
  if (!v || Object.keys(v).length === 0) return '<span class="muted">—</span>';
  return `<span class="vitals-chip">BP ${escapeHTML(v.bp || '—')}</span> <span class="vitals-chip">Temp ${escapeHTML(v.temp || '—')}</span> <span class="vitals-chip">Pulse ${escapeHTML(v.pulse || '—')}</span>`;
}

function renderDiagnoses(d) {
  if (!d || d.length === 0) return '<span class="muted">—</span>';
  return d.slice(0, 2).map(x => `<span class="badge badge-warning">${escapeHTML(x)}</span>`).join(' ') + (d.length > 2 ? `<span class="muted">+${d.length - 2}</span>` : '');
}

function renderHIV(e) {
  const parts = [];
  if (e.hiv_viral_load) parts.push(`VL: ${escapeHTML(e.hiv_viral_load)}`);
  if (e.hiv_cd4) parts.push(`CD4: ${escapeHTML(e.hiv_cd4)}`);
  if (e.art_regimen) parts.push(`ART: ${escapeHTML(e.art_regimen)}`);
  if (parts.length === 0) return '<span class="muted">—</span>';
  return parts.join('<br>');
}

async function bindEvents(container) {
  const modal = container.querySelector('#encounter-modal');
  const form = container.querySelector('#encounter-form');

  container.querySelector('#new-encounter-btn').addEventListener('click', async () => {
    editingEncId = null;
    await populateDropdowns(container);
    form.reset();
    modal.style.display = 'flex';
  });

  container.querySelector('#close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  container.querySelector('#cancel-encounter').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  container.querySelector('#enc-filter-patient').addEventListener('change', () => { encPage = 1; refreshList(container); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#enc-patient').value,
      encounter_date: new Date().toISOString(),
      visit_type: container.querySelector('#enc-visit').value,
      provider_id: container.querySelector('#enc-provider').value,
      chief_complaint: container.querySelector('#enc-complaint').value,
      vitals: {
        bp: container.querySelector('#enc-bp').value,
        temp: container.querySelector('#enc-temp').value,
        weight: container.querySelector('#enc-weight').value,
        pulse: container.querySelector('#enc-pulse').value,
        rr: container.querySelector('#enc-rr').value,
        spo2: container.querySelector('#enc-spo2').value,
        height: container.querySelector('#enc-height').value,
      },
      diagnoses: container.querySelector('#enc-diagnoses').value.split('\n').map(s => s.trim()).filter(Boolean),
      soap_notes: container.querySelector('#enc-soap').value,
      hiv_viral_load: container.querySelector('#enc-vl').value,
      hiv_cd4: container.querySelector('#enc-cd4').value,
      art_regimen: container.querySelector('#enc-art').value,
      art_adherence: container.querySelector('#enc-adherence').value,
      follow_up_plan: container.querySelector('#enc-followup').value,
    };
    try {
      if (editingEncId) {
        await apiFetch(`/encounters/${editingEncId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Encounter updated', 'success');
      } else {
        await apiFetch('/encounters', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Encounter saved successfully', 'success');
      }
      editingEncId = null;
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to save encounter', 'error');
    }
  });

  container.querySelector('#enc-weight').addEventListener('input', () => {
    const h = parseFloat(container.querySelector('#enc-height').value) || 0;
    const w = parseFloat(container.querySelector('#enc-weight').value) || 0;
    const bmi = h > 0 ? (w / ((h / 100) ** 2)).toFixed(1) : '';
    container.querySelector('#enc-bmi').value = bmi;
  });
}

async function showEditForm(container, enc) {
  editingEncId = enc.id;
  const modal = container.querySelector('#encounter-modal');
  const form = container.querySelector('#encounter-form');
  if (!modal || !form) return;
  await populateDropdowns(container);
  const set = (id, val) => { const el = form.querySelector(`#${id}`); if (el && val !== undefined && val !== null) el.value = val; };
  set('enc-patient', enc.patient_id);
  set('enc-visit', enc.visit_type);
  set('enc-provider', enc.provider_id);
  set('enc-complaint', enc.chief_complaint);
  const v = enc.vitals || {};
  set('enc-bp', v.bp);
  set('enc-temp', v.temp);
  set('enc-weight', v.weight);
  set('enc-pulse', v.pulse);
  set('enc-rr', v.rr);
  set('enc-spo2', v.spo2);
  set('enc-height', v.height);
  set('enc-bmi', (v.height && v.weight) ? (v.weight / ((v.height / 100) ** 2)).toFixed(1) : '');
  set('enc-diagnoses', Array.isArray(enc.diagnoses) ? enc.diagnoses.join('\n') : '');
  set('enc-soap', enc.soap_notes);
  set('enc-followup', enc.follow_up_plan);
  set('enc-vl', enc.hiv_viral_load);
  set('enc-cd4', enc.hiv_cd4);
  set('enc-art', enc.art_regimen);
  set('enc-adherence', enc.art_adherence);
  modal.style.display = 'flex';
}

async function populateDropdowns(container) {
  const patientSelect = container.querySelector('#enc-patient');
  const providerSelect = container.querySelector('#enc-provider');
  if (!patientSelect || !providerSelect) return;

  const patientFilter = container.querySelector('#enc-filter-patient');

  try {
    const [patientsRes, staffRes] = await Promise.all([
      apiFetch('/patients'),
      apiFetch('/users'),
    ]);
    const patients = patientsRes.patients || [];
    const staff = staffRes.users || [];

    const patientOpts = patients.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.email || 'no email')})</option>`).join('');
    patientSelect.innerHTML = '<option value="">-- Select Patient --</option>' + patientOpts;
    if (patientFilter) patientFilter.innerHTML = '<option value="">All Patients</option>' + patientOpts;

    providerSelect.innerHTML = '<option value="">-- Select Provider --</option>' +
      staff.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)} — ${escapeHTML(s.role_label || s.role)}</option>`).join('');
  } catch {
    showToast('Failed to load dropdown data', 'error');
  }
}
