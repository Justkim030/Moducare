import { showToast, escapeHTML, apiFetch, extractList } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/incident-reporting/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshAll(container);
}

export async function init(container, State) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

let incidents = [];
let searchQuery = '';
let filterCat = '';
let filterSev = '';
let filterStatus = '';
let sortKey = 'date';
let sortAsc = false;
let page = 1;
const PAGE_SIZE = 10;

function buildShell() {
  return `
  <div class="ir-layout">
    <div class="ir-header">
      <div>
        <h2 class="ir-title">Clinical Incident Reporting</h2>
        <p class="ir-subtitle">Hospital Patient Safety &amp; Operational Quality Assurance Log</p>
      </div>
      <button class="mc-btn btn-primary" id="btn-new-incident">+ Log New Incident</button>
    </div>

    <div class="ir-stats">
      <div class="ir-stat-card">
        <div class="ir-stat-label">Total Tracked</div>
        <div class="ir-stat-value" id="stat-total">0</div>
      </div>
      <div class="ir-stat-card ir-stat-review">
        <div class="ir-stat-label">Active Reviews</div>
        <div class="ir-stat-value" id="stat-review">0</div>
      </div>
      <div class="ir-stat-card ir-stat-critical">
        <div class="ir-stat-label">Critical (S1/S2)</div>
        <div class="ir-stat-value" id="stat-critical">0</div>
      </div>
      <div class="ir-stat-card ir-stat-closed">
        <div class="ir-stat-label">Closed / Resolved</div>
        <div class="ir-stat-value" id="stat-closed">0</div>
      </div>
    </div>

    <div class="ir-toolbar">
      <input type="search" class="input ir-search" id="ir-search" placeholder="Search incidents..." />
      <select class="input ir-select" id="ir-filter-category">
        <option value="">All Categories</option>
      </select>
      <select class="input ir-select" id="ir-filter-severity">
        <option value="">All Severity</option>
        <option value="S1">S1 - Catastrophic</option>
        <option value="S2">S2 - Severe Harm</option>
        <option value="S3">S3 - Moderate Harm</option>
        <option value="S4">S4 - Minor Harm</option>
        <option value="S5">S5 - Near-Miss / No Harm</option>
      </select>
      <select class="input ir-select" id="ir-filter-status">
        <option value="">All Statuses</option>
        <option>Reported</option>
        <option>Under Review</option>
        <option>Action Taken</option>
        <option>Closed</option>
      </select>
      <button class="mc-btn btn-ghost" id="ir-export-btn">Export CSV</button>
    </div>

    <div class="ir-table-card">
      <table class="mc-table ir-table">
        <thead>
          <tr>
            <th data-sort="id">ID</th>
            <th data-sort="date">Date/Time</th>
            <th data-sort="category">Category</th>
            <th data-sort="severity">Severity</th>
            <th data-sort="reporterName">Reporter</th>
            <th data-sort="status">Status</th>
          </tr>
        </thead>
        <tbody id="incident-table-body"></tbody>
      </table>
      <div class="ir-pagination" id="ir-pagination"></div>
    </div>
  </div>

  <div id="incident-modal-root" class="modal-overlay" style="display:none;">
    <div class="modal-card" style="max-width:640px;">
      <div class="modal-header">
        <h2 id="modal-title">Log Clinical Incident</h2>
        <button class="modal-close" id="modal-close">&times;</button>
      </div>
      <div id="modal-body-content"></div>
    </div>
  </div>`;
}

async function loadIncidents() {
  try {
    const data = await apiFetch('/incidents');
    incidents = extractList(data, 'incidents');
  } catch (e) {
    showToast('Failed to load incidents', 'error');
    incidents = [];
  }
}

async function refreshAll(container) {
  await loadIncidents();
  updateMetrics();
  renderTable(container);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusClass(s) {
  const map = { Reported: 'badge-info', 'Under Review': 'badge-warning', 'Action Taken': 'badge-primary', Closed: 'badge-success' };
  return map[s] || 'badge-neutral';
}

function severityColor(sev) {
  const map = { S1: '#dc2626', S2: '#ff6b6b', S3: '#fcc419', S4: '#339af0', S5: '#16a34a' };
  return map[sev] || '#ccc';
}

function filtered() {
  const q = searchQuery.toLowerCase();
  return incidents.filter(i => {
    const matchQ = !q
      || String(i.id).toLowerCase().includes(q)
      || (i.title || '').toLowerCase().includes(q)
      || (i.category || '').toLowerCase().includes(q)
      || (i.description || '').toLowerCase().includes(q);
    const matchCat = !filterCat || i.category === filterCat;
    const matchSev = !filterSev || i.severity === filterSev;
    const matchStatus = !filterStatus || i.status === filterStatus;
    return matchQ && matchCat && matchSev && matchStatus;
  }).sort((a, b) => {
    let va = a[sortKey] || '', vb = b[sortKey] || '';
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });
}

function updateMetrics(container) {
  const total = incidents.length;
  const review = incidents.filter(i => i.status === 'Under Review').length;
  const critical = incidents.filter(i => ['S1','S2'].includes(i.severity) && i.status !== 'Closed').length;
  const closed = incidents.filter(i => i.status === 'Closed').length;
  const set = (id, val) => { const el = container.querySelector(`#${id}`); if (el) el.textContent = val; };
  set('stat-total', total);
  set('stat-review', review);
  set('stat-critical', critical);
  set('stat-closed', closed);
}

function renderTable(container) {
  const tableBody = container.querySelector('#incident-table-body');
  if (!tableBody) return;

  const rows = filtered();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) page = pages;
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  updateMetrics(container);

  if (slice.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-tertiary)">No incidents found.</td></tr>`;
  } else {
    tableBody.innerHTML = slice.map(i => {
      const sev = severityColor(i.severity);
      return `
        <tr class="ir-clickable-row" data-id="${i.id}" style="cursor:pointer">
          <td><strong>${i.id}</strong></td>
          <td>${fmtDateTime(i.created)} <span class="mc-muted">${i.time || ''}</span></td>
          <td>${escapeHTML(i.category || '—')}</td>
          <td><span class="badge" style="background:${sev};color:#fff;font-size:.72rem">${escapeHTML(i.severity || 'N/A')}</span></td>
          <td>${escapeHTML(i.reporter_name || 'Unassigned')} <span class="mc-muted">(${escapeHTML(i.reporter_role || 'Staff')})</span></td>
          <td><span class="badge ${statusClass(i.status)}">${escapeHTML(i.status || 'N/A')}</span></td>
        </tr>`;
    }).join('');

    tableBody.querySelectorAll('.ir-clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const inc = incidents.find(i => String(i.id) === row.dataset.id);
        if (inc) showDetail(container, inc);
      });
    });
  }

  const pagination = container.querySelector('#ir-pagination');
  if (pagination) {
    if (total === 0) { pagination.innerHTML = ''; return; }
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    pagination.innerHTML = `
      <span style="font-size:.8rem;color:var(--text-secondary)">Showing ${start}–${end} of ${total}</span>
      <div style="display:flex;gap:5px">
        <button class="mc-btn btn-sm ir-pg-btn" data-pg="${page-1}" ${page===1?'disabled':''}>&laquo; Prev</button>
        ${Array.from({length:pages},(_,i)=>`<button class="mc-btn btn-sm ir-pg-btn${i+1===page?' active':''}" data-pg="${i+1}">${i+1}</button>`).join('')}
        <button class="mc-btn btn-sm ir-pg-btn" data-pg="${page+1}" ${page===pages?'disabled':''}>Next &raquo;</button>
      </div>`;
    pagination.querySelectorAll('.ir-pg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = Number(btn.dataset.pg);
        if (t >= 1 && t <= pages) { page = t; renderTable(container); }
      });
    });
  }
}

function showNewForm(container) {
  const modalRoot = container.querySelector('#incident-modal-root');
  const modalBody = container.querySelector('#modal-body-content');
  const modalTitle = container.querySelector('#modal-title');
  if (!modalRoot || !modalBody) return;

  modalTitle.textContent = 'Log Clinical Incident';
  const now = new Date();
  const defaultDT = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  modalBody.innerHTML = `
    <form id="ir-form" class="ir-form">
      <div class="ir-form-section">
        <label class="ir-label">Category <span class="ir-required">*</span></label>
        <select class="input" id="ir-category" required>
          <option value="">— Select type —</option>
          <option>Patient Safety (Falls, Medication Error)</option>
          <option>Clinical Near-Miss</option>
          <option>Equipment &amp; Facilities Malfunction</option>
          <option>Infection Control Breach</option>
          <option>Staff Safety / Needle Stick</option>
          <option>Patient Complaint / Conduct</option>
        </select>
        <div class="ir-field-error" id="ir-err-category"></div>
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Severity <span class="ir-required">*</span></label>
          <select class="input" id="ir-severity" required>
            <option value="">— Select —</option>
            <option value="S1">S1 - Catastrophic</option>
            <option value="S2">S2 - Severe Harm</option>
            <option value="S3">S3 - Moderate Harm</option>
            <option value="S4">S4 - Minor Harm</option>
            <option value="S5">S5 - Near-Miss / No Harm</option>
          </select>
          <div class="ir-field-error" id="ir-err-severity"></div>
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Date &amp; Time <span class="ir-required">*</span></label>
          <input type="datetime-local" class="input" id="ir-datetime" value="${defaultDT}" required />
          <div class="ir-field-error" id="ir-err-datetime"></div>
        </div>
      </div>
      <div class="ir-form-section">
        <label class="ir-label">Title <span class="ir-required">*</span></label>
        <input type="text" class="input" id="ir-title" required placeholder="Short incident title" />
        <div class="ir-field-error" id="ir-err-title"></div>
      </div>
      <div class="ir-form-section">
        <label class="ir-label">Description <span class="ir-required">*</span></label>
        <textarea class="input" id="ir-desc" rows="3" required placeholder="What happened? Include who was involved and what was occurring at the time."></textarea>
        <div class="ir-field-error" id="ir-err-desc"></div>
      </div>
      <div class="ir-form-section">
        <label class="ir-label">Immediate Action Taken</label>
        <textarea class="input" id="ir-action" rows="2" placeholder="e.g. Physician notified, patient moved, equipment isolated…"></textarea>
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Patient ID</label>
          <input type="text" class="input" id="ir-patient" placeholder="e.g. PAT-0042" />
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Witness</label>
          <input type="text" class="input" id="ir-witness" placeholder="Full name" />
        </div>
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Your Name <span class="ir-required">*</span></label>
          <input type="text" class="input" id="ir-reporter" required placeholder="Full name" />
          <div class="ir-field-error" id="ir-err-reporter"></div>
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Your Role <span class="ir-required">*</span></label>
          <select class="input" id="ir-role" required>
            <option value="">— Select —</option>
            <option>Doctor / Physician</option>
            <option>Nurse</option>
            <option>Clinical Officer</option>
            <option>Pharmacist</option>
            <option>Lab Technician</option>
            <option>Radiographer</option>
            <option>Ward Administrator</option>
            <option>Patient / Next of Kin</option>
            <option>Other Staff</option>
          </select>
          <div class="ir-field-error" id="ir-err-role"></div>
        </div>
      </div>
      <div class="ir-form-actions">
        <button type="button" class="mc-btn btn-secondary" id="ir-cancel">Cancel</button>
        <button type="submit" class="mc-btn btn-primary">Save Incident</button>
      </div>
    </form>`;

  modalRoot.style.display = 'flex';
  const form = modalRoot.querySelector('#ir-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => modalRoot.querySelector(`#${id}`).value.trim();
    const valid = true;
    const setErr = (id, msg) => {
      const el = modalRoot.querySelector(`#ir-err-${id}`);
      if (el) el.textContent = msg;
    };

    const payload = {
      title: v('ir-title'),
      description: v('ir-desc'),
      severity: v('ir-severity'),
      status: 'Reported',
      category: v('ir-category'),
      patient_id: v('ir-patient'),
      time: v('ir-datetime'),
      reporter_role: v('ir-role'),
      action_taken: v('ir-action'),
      witness_name: v('ir-witness'),
    };

    try {
      const data = await apiFetch('/incidents', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Incident created successfully', 'success');
      modalRoot.style.display = 'none';
      page = 1;
      refreshAll(container);
    } catch (err) {
      showToast(err.message || 'Failed to create incident', 'error');
    }
  });

  modalRoot.querySelector('#ir-cancel').addEventListener('click', () => {
    modalRoot.style.display = 'none';
  });
}

function showDetail(container, inc) {
  const modalRoot = container.querySelector('#incident-modal-root');
  const modalBody = container.querySelector('#modal-body-content');
  const modalTitle = container.querySelector('#modal-title');
  if (!modalRoot || !modalBody) return;

  modalTitle.textContent = `Incident ${inc.id}`;
  const sev = severityColor(inc.severity);
  modalBody.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">
      <span class="badge" style="background:${sev};color:#fff">${escapeHTML(inc.severity || 'N/A')}</span>
      <span class="badge ${statusClass(inc.status)}">${escapeHTML(inc.status || 'N/A')}</span>
      <span class="badge badge-neutral">${escapeHTML(inc.category || 'Uncategorized')}</span>
    </div>
    <div class="ir-detail-grid">
      <div><span class="ir-detail-label">Date</span><span>${fmtDateTime(inc.created)} ${inc.time ? inc.time : ''}</span></div>
      <div><span class="ir-detail-label">Patient ID</span><span>${inc.patient_id || '—'}</span></div>
      <div><span class="ir-detail-label">Reporter</span><span>${escapeHTML(inc.reporter_name || 'Unassigned')} (${escapeHTML(inc.reporter_role || 'Staff')})</span></div>
      <div><span class="ir-detail-label">Witness</span><span>${inc.witness_name ? escapeHTML(inc.witness_name) : '—'}</span></div>
    </div>
    <div class="ir-detail-block">
      <div class="ir-detail-label">Title</div>
      <p>${escapeHTML(inc.title || '—')}</p>
    </div>
    <div class="ir-detail-block">
      <div class="ir-detail-label">What happened</div>
      <p>${escapeHTML(inc.description || '—')}</p>
    </div>
    ${inc.action_taken ? `<div class="ir-detail-block">
      <div class="ir-detail-label">Immediate action taken</div>
      <p>${escapeHTML(inc.action_taken)}</p>
    </div>` : ''}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:1rem">
      <button class="mc-btn btn-primary" id="ir-edit">Edit</button>
      <button class="mc-btn btn-secondary" id="ir-delete">Delete</button>
      <button class="mc-btn btn-ghost" id="ir-close">Close</button>
    </div>`;

  modalRoot.style.display = 'flex';
  modalRoot.querySelector('#ir-close').addEventListener('click', () => {
    modalRoot.style.display = 'none';
  });
  modalRoot.querySelector('#ir-edit').addEventListener('click', () => showEditForm(container, inc));
  modalRoot.querySelector('#ir-delete').addEventListener('click', async () => {
    if (!confirm('Delete this incident?')) return;
    try {
      await apiFetch(`/incidents/${inc.id}`, { method: 'DELETE' });
      showToast('Incident deleted', 'success');
      modalRoot.style.display = 'none';
      refreshAll(container);
    } catch (err) {
      showToast(err.message || 'Delete failed', 'error');
    }
  });
}

function showEditForm(container, inc) {
  const modalRoot = container.querySelector('#incident-modal-root');
  const modalBody = container.querySelector('#modal-body-content');
  const modalTitle = container.querySelector('#modal-title');
  if (!modalRoot || !modalBody) return;

  modalTitle.textContent = `Edit Incident ${inc.id}`;
  const sevOpts = ['S1', 'S2', 'S3', 'S4', 'S5'].map(s =>
    `<option value="${s}" ${inc.severity === s ? 'selected' : ''}>${s}</option>`).join('');
  const statusOpts = ['Reported', 'Under Review', 'Action Taken', 'Closed'].map(s =>
    `<option ${inc.status === s ? 'selected' : ''}>${s}</option>`).join('');

  modalBody.innerHTML = `
    <form id="ir-edit-form" class="ir-form">
      <div class="ir-form-section">
        <label class="ir-label">Title <span class="ir-required">*</span></label>
        <input type="text" class="input" id="ir-edit-title" value="${escapeHTML(inc.title || '')}" required />
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Severity <span class="ir-required">*</span></label>
          <select class="input" id="ir-edit-severity" required>${sevOpts}</select>
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Status <span class="ir-required">*</span></label>
          <select class="input" id="ir-edit-status" required>${statusOpts}</select>
        </div>
      </div>
      <div class="ir-form-section">
        <label class="ir-label">Description <span class="ir-required">*</span></label>
        <textarea class="input" id="ir-edit-desc" rows="3" required>${escapeHTML(inc.description || '')}</textarea>
      </div>
      <div class="ir-form-actions">
        <button type="button" class="mc-btn btn-secondary" id="ir-edit-cancel">Cancel</button>
        <button type="submit" class="mc-btn btn-primary">Save Changes</button>
      </div>
    </form>`;

  modalRoot.style.display = 'flex';

  modalBody.querySelector('#ir-edit-cancel').addEventListener('click', () => {
    modalRoot.style.display = 'none';
  });

  modalBody.querySelector('#ir-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: modalBody.querySelector('#ir-edit-title').value.trim(),
      severity: modalBody.querySelector('#ir-edit-severity').value,
      status: modalBody.querySelector('#ir-edit-status').value,
      description: modalBody.querySelector('#ir-edit-desc').value.trim(),
    };
    try {
      await apiFetch(`/incidents/${inc.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Incident updated', 'success');
      modalRoot.style.display = 'none';
      refreshAll(container);
    } catch (err) {
      showToast(err.message || 'Failed to update incident', 'error');
    }
  });
}

function exportCSV(container) {
  const rows = filtered();
  const headers = ['ID','Date','Time','Category','Severity','Status','Reporter','Role','Patient ID','Description','Action Taken'];
  const lines = [headers.join(','), ...rows.map(i => [
    i.id, fmtDate(i.created), i.time||'', i.category||'', i.severity||'', i.status||'',
    `"${(i.reporter_name||'').replace(/"/g,'""')}"`, `"${(i.reporter_role||'').replace(/"/g,'""')}"`,
    i.patient_id||'', `"${(i.description||'').replace(/"/g,'""')}"`, `"${(i.action_taken||'').replace(/"/g,'""')}"`,
  ].join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `incidents-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function bindEvents(container) {
  container.querySelector('#btn-new-incident').addEventListener('click', () => showNewForm(container));
  container.querySelector('#modal-close').addEventListener('click', () => {
    container.querySelector('#incident-modal-root').style.display = 'none';
  });
  container.querySelector('#ir-export-btn').addEventListener('click', () => exportCSV(container));
  container.querySelector('#ir-search').addEventListener('input', (e) => { searchQuery = e.target.value; page = 1; renderTable(container); });
  container.querySelector('#ir-filter-category').addEventListener('change', (e) => { filterCat = e.target.value; page = 1; renderTable(container); });
  container.querySelector('#ir-filter-severity').addEventListener('change', (e) => { filterSev = e.target.value; page = 1; renderTable(container); });
  container.querySelector('#ir-filter-status').addEventListener('change', (e) => { filterStatus = e.target.value; page = 1; renderTable(container); });

  const table = container.querySelector('#incident-table');
  if (table) {
    table.querySelectorAll('th[data-sort]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        sortAsc = sortKey === th.dataset.sort ? !sortAsc : true;
        sortKey = th.dataset.sort;
        renderTable(container);
      });
    });
  }

  const modalRoot = container.querySelector('#incident-modal-root');
  if (modalRoot) {
    modalRoot.addEventListener('click', (e) => { if (e.target === modalRoot) modalRoot.style.display = 'none'; });
  }
}
