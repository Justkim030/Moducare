/**
 * Clinical Incident Reporting â€” Feature Controller
 * ModuCare module contract: export async function init(mount, State)
 */
import { showToast, escapeHTML } from '../../../../js/utils.js';
import { INCIDENT_SEVERITIES, INCIDENT_CATEGORIES }

async function loadIncidents() {
  try {
    const res = await fetch('/api/incidents');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');
    return (data.incidents || []).map(i => ({
      id: i.id,
      date: i.created ? i.created.split('T')[0] : i.date,
      title: i.title || '',
      description: i.description || '',
      status: i.status,
      severity: i.severity,
      reportedBy: i.reporter_name || ''
    }));
  } catch (e) {
    showToast('Failed to load incidents', 'error');
    return [];
  }
} from './data/incidents.js';

export async function init(mount, State) {
  let incidents = await loadIncidents();
  let searchQuery  = '';
  let filterCat    = '';
  let filterSev    = '';
  let filterStatus = '';
  let sortKey      = 'date';
  let sortAsc      = false;
  let page         = 1;
  const PAGE_SIZE  = 10;

  const tableBody    = mount.querySelector('#incident-table-body');
  const btnNew       = mount.querySelector('#btn-new-incident');
  const modalRoot    = mount.querySelector('#incident-modal-root');
  const modalClose   = mount.querySelector('#modal-close');
  const modalBody    = mount.querySelector('#modal-body-content');
  const modalTitle   = mount.querySelector('#modal-title');
  const searchInput  = mount.querySelector('#ir-search');
  const filterCatEl  = mount.querySelector('#ir-filter-category');
  const filterSevEl  = mount.querySelector('#ir-filter-severity');
  const filterStatEl = mount.querySelector('#ir-filter-status');
  const exportBtn    = mount.querySelector('#ir-export-btn');
  const pagination   = mount.querySelector('#ir-pagination');

  function fmtDate(d) {
    if (!d) return 'â€”';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function filtered() {
    const q = searchQuery.toLowerCase();
    return incidents.filter(i => {
      const matchQ = !q
        || i.id.toLowerCase().includes(q)
        || i.category.toLowerCase().includes(q)
        || i.reporterName.toLowerCase().includes(q)
        || (i.patientId || '').toLowerCase().includes(q)
        || (i.description || '').toLowerCase().includes(q);
      const matchCat    = !filterCat    || i.category === filterCat;
      const matchSev    = !filterSev    || i.severity === filterSev;
      const matchStatus = !filterStatus || i.status   === filterStatus;
      return matchQ && matchCat && matchSev && matchStatus;
    }).sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });
  }

  function updateMetrics() {
    const set = (id, val) => { const el = mount.querySelector(id); if (el) el.textContent = val; };
    set('#stat-total',    incidents.length);
    set('#stat-review',   incidents.filter(i => i.status === 'Under Review').length);
    set('#stat-critical', incidents.filter(i => ['S1','S2'].includes(i.severity) && i.status !== 'Closed').length);
    set('#stat-closed',   incidents.filter(i => i.status === 'Closed').length);
  }

  function renderTable() {
    if (!tableBody) return;
    const rows  = filtered();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) page = pages;
    const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (slice.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="mc-muted" style="text-align:center;padding:2rem">No incidents match your search.</td></tr>`;
    } else {
      tableBody.innerHTML = slice.map(i => {
        const sev = INCIDENT_SEVERITIES[i.severity] || {};
        const statusClass = i.status === 'Closed' ? 'badge-success'
          : i.status === 'Action Taken' ? 'badge-primary'
          : i.status === 'Under Review' ? 'badge-warning'
          : 'badge-danger';
        return `
          <tr class="ir-clickable-row" data-id="${i.id}" style="cursor:pointer">
            <td><strong>${i.id}</strong></td>
            <td>${fmtDate(i.date)} <span class="mc-muted">${i.time || ''}</span></td>
            <td>${i.category}</td>
            <td><span class="badge" style="background:${sev.color||'#ccc'};color:#fff;font-size:.72rem">${i.severity}</span></td>
            <td>${i.reporterName} <span class="mc-muted">(${i.reporterRole})</span></td>
            <td><span class="badge ${statusClass}">${i.status}</span></td>
          </tr>`;
      }).join('');

      tableBody.querySelectorAll('.ir-clickable-row').forEach(row => {
        row.addEventListener('click', () => {
          const inc = incidents.find(i => i.id === row.dataset.id);
          if (inc) showDetail(inc);
        });
      });
    }

    if (pagination) {
      if (total === 0) { pagination.innerHTML = ''; return; }
      const start = (page - 1) * PAGE_SIZE + 1;
      const end   = Math.min(page * PAGE_SIZE, total);
      pagination.innerHTML = `
        <span class="mc-muted" style="font-size:.8rem">Showing ${start}â€“${end} of ${total}</span>
        <div style="display:flex;gap:5px">
          <button class="mc-btn mc-btn--sm ir-pg-btn" data-pg="${page-1}" ${page===1?'disabled':''}>â€¹ Prev</button>
          ${Array.from({length:pages},(_,i)=>`<button class="mc-btn mc-btn--sm ir-pg-btn${i+1===page?' active':''}" data-pg="${i+1}">${i+1}</button>`).join('')}
          <button class="mc-btn mc-btn--sm ir-pg-btn" data-pg="${page+1}" ${page===pages?'disabled':''}>Next â€º</button>
        </div>`;
      pagination.querySelectorAll('.ir-pg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = Number(btn.dataset.pg);
          if (t >= 1 && t <= pages) { page = t; renderTable(); }
        });
      });
    }
  }

  function showNewForm() {
    if (!modalRoot || !modalBody) return;
    modalTitle.textContent = 'Log Clinical Incident';
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultDT = now.toISOString().slice(0,16);

    modalBody.innerHTML = `
      <div class="ir-form-section">
        <label class="ir-label">Incident Type <span class="ir-required">*</span></label>
        <select class="input" id="mf-category">
          <option value="">â€” Select type â€”</option>
          ${INCIDENT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <span class="ir-field-error" id="mf-err-category"></span>
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Severity <span class="ir-required">*</span></label>
          <select class="input" id="mf-severity">
            <option value="">â€” Select â€”</option>
            ${Object.entries(INCIDENT_SEVERITIES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <span class="ir-field-error" id="mf-err-severity"></span>
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Date &amp; Time <span class="ir-required">*</span></label>
          <input type="datetime-local" class="input" id="mf-datetime" value="${defaultDT}" />
          <span class="ir-field-error" id="mf-err-datetime"></span>
        </div>
      </div>
      <div class="ir-form-section">
        <label class="ir-label">Description <span class="ir-required">*</span></label>
        <textarea class="input" id="mf-desc" rows="3" placeholder="What happened? Include who was involved and what was occurring at the time."></textarea>
        <span class="ir-field-error" id="mf-err-desc"></span>
      </div>
      <div class="ir-form-section">
        <label class="ir-label">Immediate Action Taken</label>
        <textarea class="input" id="mf-action" rows="2" placeholder="e.g. Physician notified, patient moved, equipment isolatedâ€¦"></textarea>
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Patient ID</label>
          <input type="text" class="input" id="mf-patient" placeholder="e.g. PAT-0042" />
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Witness</label>
          <input type="text" class="input" id="mf-witness" placeholder="Full name" />
        </div>
      </div>
      <div class="ir-form-row-2">
        <div class="ir-form-section">
          <label class="ir-label">Your Name <span class="ir-required">*</span></label>
          <input type="text" class="input" id="mf-reporter" placeholder="Full name" />
          <span class="ir-field-error" id="mf-err-reporter"></span>
        </div>
        <div class="ir-form-section">
          <label class="ir-label">Your Role <span class="ir-required">*</span></label>
          <select class="input" id="mf-role">
            <option value="">â€” Select â€”</option>
            <option>Doctor / Physician</option><option>Nurse</option>
            <option>Clinical Officer</option><option>Pharmacist</option>
            <option>Lab Technician</option><option>Radiographer</option>
            <option>Ward Administrator</option><option>Patient / Next of Kin</option>
            <option>Other Staff</option>
          </select>
          <span class="ir-field-error" id="mf-err-role"></span>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:1rem">
        <button class="mc-btn" id="mf-cancel">Cancel</button>
        <button class="mc-btn btn-primary" id="mf-submit">Submit Report</button>
      </div>`;

    modalRoot.classList.remove('hidden');
    mount.querySelector('#mf-cancel').addEventListener('click', closeModal);
    mount.querySelector('#mf-submit').addEventListener('click', () => {
      const v = id => mount.querySelector(id)?.value.trim();
      let valid = true;
      const setErr = (id, msg) => {
        const el = mount.querySelector(`#mf-err-${id}`);
        if (el) el.textContent = msg;
        if (msg) valid = false;
      };
      setErr('category', !v('#mf-category') ? 'Required.' : '');
      setErr('severity', !v('#mf-severity') ? 'Required.' : '');
      setErr('datetime', !v('#mf-datetime') ? 'Required.' : '');
      setErr('desc',     !v('#mf-desc')     ? 'Required.' : '');
      setErr('reporter', !v('#mf-reporter') ? 'Required.' : '');
      setErr('role',     !v('#mf-role')     ? 'Required.' : '');
      if (!valid) return;
      const dt = v('#mf-datetime').split('T');
      incidents.unshift({
        id:           `INC-${new Date().getFullYear()}-${String(incidents.length+1).padStart(3,'0')}`,
        date:         dt[0],
        time:         dt[1] || '',
        category:     v('#mf-category'),
        severity:     v('#mf-severity'),
        patientId:    v('#mf-patient'),
        reporterName: v('#mf-reporter'),
        reporterRole: v('#mf-role'),
        description:  v('#mf-desc'),
        actionTaken:  v('#mf-action'),
        witnessName:  v('#mf-witness'),
        status:       'Reported',
      });
      page = 1;
      closeModal();
      updateMetrics();
      renderTable();
    });
  }

  function showDetail(inc) {
    if (!modalRoot || !modalBody) return;
    const sev = INCIDENT_SEVERITIES[inc.severity] || {};
    modalTitle.textContent = `Incident ${inc.id}`;
    modalBody.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">
        <span class="badge" style="background:${sev.color||'#ccc'};color:#fff">${inc.severity}</span>
        <span class="badge badge-primary">${inc.status}</span>
        <span class="badge">${inc.category}</span>
      </div>
      <div class="ir-detail-grid">
        <div><span class="ir-detail-label">Date</span><span>${fmtDate(inc.date)} ${inc.time||''}</span></div>
        <div><span class="ir-detail-label">Patient ID</span><span>${inc.patientId||'â€”'}</span></div>
        <div><span class="ir-detail-label">Reporter</span><span>${inc.reporterName} (${inc.reporterRole})</span></div>
        <div><span class="ir-detail-label">Witness</span><span>${inc.witnessName||'â€”'}</span></div>
      </div>
      <div class="ir-detail-block">
        <div class="ir-detail-label">What happened</div>
        <p>${inc.description||'â€”'}</p>
      </div>
      ${inc.actionTaken ? `<div class="ir-detail-block">
        <div class="ir-detail-label">Immediate action taken</div>
        <p>${inc.actionTaken}</p>
      </div>` : ''}
      <div style="display:flex;justify-content:flex-end;margin-top:1rem">
        <button class="mc-btn" id="mf-cancel">Close</button>
      </div>`;
    modalRoot.classList.remove('hidden');
    mount.querySelector('#mf-cancel').addEventListener('click', closeModal);
  }

  function closeModal() {
    if (modalRoot) modalRoot.classList.add('hidden');
  }

  function exportCSV() {
    const rows = filtered();
    const headers = ['ID','Date','Time','Category','Severity','Status','Reporter','Role','Patient ID','Description','Action Taken'];
    const lines = [headers.join(','), ...rows.map(i => [
      i.id, i.date, i.time||'', i.category, i.severity, i.status,
      i.reporterName, i.reporterRole, i.patientId||'',
      `"${(i.description||'').replace(/"/g,'""')}"`,
      `"${(i.actionTaken||'').replace(/"/g,'""')}"`,
    ].join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `incidents-${new Date().toISOString().split('T')[0]}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (btnNew)       btnNew.addEventListener('click', showNewForm);
  if (modalClose)   modalClose.addEventListener('click', closeModal);
  if (exportBtn)    exportBtn.addEventListener('click', exportCSV);
  if (searchInput)  searchInput.addEventListener('input', e => { searchQuery = e.target.value; page = 1; renderTable(); });
  if (filterCatEl)  filterCatEl.addEventListener('change', e => { filterCat = e.target.value; page = 1; renderTable(); });
  if (filterSevEl)  filterSevEl.addEventListener('change', e => { filterSev = e.target.value; page = 1; renderTable(); });
  if (filterStatEl) filterStatEl.addEventListener('change', e => { filterStatus = e.target.value; page = 1; renderTable(); });

  const thead = mount.querySelector('#incident-table thead');
  if (thead) {
    thead.querySelectorAll('th[data-sort]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        sortAsc = sortKey === key ? !sortAsc : true;
        sortKey = key;
        renderTable();
      });
    });
  }

  if (modalRoot) modalRoot.addEventListener('click', e => { if (e.target === modalRoot) closeModal(); });

  updateMetrics();
  renderTable();

  return { destroy: () => {} };
}
