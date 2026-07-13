import { showToast, formatDate, escapeHTML, apiFetch, buildPaginationHTML, attachPagination } from '../../../js/utils.js';

export async function init(mount) {
  bindEvents(mount);
  loadOverview(mount);
  loadScheduled(mount);
  return { destroy() { if (mount) mount.innerHTML = ''; } };
}

function bindEvents(mount) {
  mount.querySelectorAll('.reports-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mount.querySelectorAll('.reports-tab').forEach(t => t.classList.remove('active'));
      mount.querySelectorAll('.reports-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = mount.querySelector(`.reports-panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  mount.querySelector('#new-scheduled-btn')?.addEventListener('click', () => {
    mount.querySelector('#scheduled-modal').style.display = 'flex';
  });

  mount.querySelector('#close-scheduled-modal')?.addEventListener('click', () => {
    mount.querySelector('#scheduled-modal').style.display = 'none';
  });

  mount.querySelector('#cancel-scheduled')?.addEventListener('click', () => {
    mount.querySelector('#scheduled-modal').style.display = 'none';
  });

  mount.querySelector('#scheduled-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      name: mount.querySelector('#sched-name')?.value.trim(),
      schedule: mount.querySelector('#sched-freq')?.value,
      source: mount.querySelector('#sched-source')?.value,
      recipients: mount.querySelector('#sched-recipients')?.value.trim(),
      columns: ['id', 'name', 'date', 'status'],
    };
    apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) })
      .then(() => {
        showToast('Scheduled report created', 'success');
        mount.querySelector('#scheduled-modal').style.display = 'none';
        mount.querySelector('#scheduled-form')?.reset();
        loadScheduled(mount);
      })
      .catch(err => showToast(err.message || 'Failed', 'error'));
  });

  mount.querySelector('#report-builder-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      name: mount.querySelector('#rpt-name')?.value.trim(),
      source: mount.querySelector('#rpt-source')?.value,
      columns: mount.querySelector('#rpt-cols')?.value.split(',').map(s => s.trim()).filter(Boolean),
      filters: parseJSON(mount.querySelector('#rpt-filters')?.value || '{}'),
      sort: mount.querySelector('#rpt-sort')?.value.trim(),
      limit: parseInt(mount.querySelector('#rpt-limit')?.value) || 100,
    };
    apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) })
      .then(data => {
        const result = mount.querySelector('#report-result');
        if (data && data.data) {
          result.innerHTML = `
            <h3>${escapeHTML(payload.name)} — ${data.data.length} rows</h3>
            <table><thead><tr>${payload.columns.map(c => `<th>${escapeHTML(c)}</th>`).join('')}</tr></thead>
            <tbody>${data.data.slice(0, 50).map(row => `<tr>${payload.columns.map(c => `<td>${escapeHTML(row[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
        } else {
          result.innerHTML = `<p>${escapeHTML(data?.error || 'No data returned')}</p>`;
        }
      })
      .catch(err => showToast(err.message || 'Failed', 'error'));
  });

  mount.querySelector('#preview-report')?.addEventListener('click', () => {
    const payload = {
      source: mount.querySelector('#rpt-source')?.value,
      columns: mount.querySelector('#rpt-cols')?.value.split(',').map(s => s.trim()).filter(Boolean),
      filters: parseJSON(mount.querySelector('#rpt-filters')?.value || '{}'),
      sort: mount.querySelector('#rpt-sort')?.value.trim(),
      limit: parseInt(mount.querySelector('#rpt-limit')?.value) || 100,
    };
    apiFetch('/reports', { method: 'POST', body: JSON.stringify({ ...payload, name: 'Preview' }) })
      .then(data => {
        const result = mount.querySelector('#report-result');
        if (data && data.data) {
          result.innerHTML = `
            <h3>Preview — ${data.data.length} rows</h3>
            <table><thead><tr>${payload.columns.map(c => `<th>${escapeHTML(c)}</th>`).join('')}</tr></thead>
            <tbody>${data.data.slice(0, 20).map(row => `<tr>${payload.columns.map(c => `<td>${escapeHTML(row[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
        } else {
          result.innerHTML = `<p>${escapeHTML(data?.error || 'No data returned')}</p>`;
        }
      })
      .catch(err => showToast(err.message || 'Failed', 'error'));
  });

  mount.querySelector('#scheduled-table-wrap')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'run') {
      apiFetch(`/reports/scheduled/${id}/run`, { method: 'POST' })
        .then(data => {
          showToast('Report executed', 'success');
          const result = mount.querySelector('#report-result');
          if (data && data.data) {
            result.innerHTML = `<pre>${escapeHTML(JSON.stringify(data.data, null, 2))}</pre>`;
          }
        })
        .catch(err => showToast(err.message || 'Failed', 'error'));
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('Delete this scheduled report?')) return;
      apiFetch(`/reports/${id}`, { method: 'DELETE' })
        .then(() => {
          showToast('Deleted', 'success');
          loadScheduled(mount);
        })
        .catch(err => showToast(err.message || 'Failed', 'error'));
    }
  });
}

function parseJSON(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

function loadOverview(mount) {
  const grid = mount.querySelector('#reports-grid');
  if (!grid) return;
  const reportTemplates = [
    { icon: '👥', title: 'Patient Summary', desc: 'All registered patients with demographics', source: 'patients', columns: 'id, name, email, phone_number, gender, county' },
    { icon: '📅', title: 'Appointment Schedule', desc: 'Upcoming and past appointments', source: 'appointments', columns: 'id, time, type, status, patient_id' },
    { icon: '🩺', title: 'Encounter Log', desc: 'Clinical encounters with diagnoses', source: 'encounters', columns: 'id, patient_id, encounter_date, visit_type, diagnoses' },
    { icon: '🧪', title: 'Lab Results', desc: 'Lab orders with results', source: 'lab_orders', columns: 'id, patient_id, test_name, status, result_value, result_date' },
    { icon: '💊', title: 'Pharmacy Dispensing', desc: 'Medication dispensing records', source: 'pharmacy', columns: 'id, patient_id, drug_name, quantity, dispensed_at' },
    { icon: '💰', title: 'Financial Summary', desc: 'Invoices and payments', source: 'finance', columns: 'id, type, reference, amount, status, date' },
    { icon: '⚙️', title: 'Operations Tasks', desc: 'Task status and assignments', source: 'operations', columns: 'id, title, priority, status, assignee, due' },
    { icon: '📦', title: 'Inventory Status', desc: 'Stock levels and alerts', source: 'inventory', columns: 'id, name, category, current_stock, reorder_level, supplier' },
    { icon: '⏰', title: 'Attendance Report', desc: 'Clock in/out and hours', source: 'attendance', columns: 'id, user_id, date, clock_in, clock_out, total_hours, status' },
    { icon: '📅', title: 'Leave Summary', desc: 'Leave requests and approvals', source: 'leave', columns: 'id, user_id, leave_type, start_date, end_date, days_count, status' },
  ];

  grid.innerHTML = reportTemplates.map(t => `
    <div class="report-card" data-source="${t.source}" data-columns="${encodeURIComponent(t.columns)}">
      <div class="report-card__icon">${t.icon}</div>
      <div class="report-card__title">${escapeHTML(t.title)}</div>
      <div class="report-card__desc">${escapeHTML(t.desc)}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.report-card').forEach(card => {
    card.addEventListener('click', () => {
      const source = card.dataset.source;
      const columns = JSON.parse(decodeURIComponent(card.dataset.columns));
      mount.querySelector('#rpt-source').value = source;
      mount.querySelector('#rpt-cols').value = columns.join(', ');
      mount.querySelectorAll('.reports-tab').forEach(t => t.classList.remove('active'));
      mount.querySelectorAll('.reports-panel').forEach(p => p.classList.remove('active'));
      const builderTab = mount.querySelector('.reports-tab[data-tab="builder"]');
      const builderPanel = mount.querySelector('.reports-panel[data-panel="builder"]');
      if (builderTab) builderTab.classList.add('active');
      if (builderPanel) builderPanel.classList.add('active');
    });
  });
}

async function loadScheduled(mount) {
  const wrap = mount.querySelector('#scheduled-table-wrap');
  const pg = mount.querySelector('#scheduled-pagination');
  try {
    const data = await apiFetch('/reports/scheduled?page=1&limit=25');
    const rows = data.data || [];
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><h3>No scheduled reports</h3><p>Create a scheduled report to automate data delivery.</p></div>`;
      if (pg) pg.innerHTML = '';
      return;
    }
    wrap.innerHTML = `
      <div class="hr-table-wrap">
        <table class="hr-table">
          <thead><tr><th>Name</th><th>Source</th><th>Frequency</th><th>Recipients</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="font-weight-500">${escapeHTML(r.name)}</td>
                <td><span class="badge badge-neutral">${escapeHTML(r.source)}</span></td>
                <td>${escapeHTML(r.schedule || '—')}</td>
                <td>${escapeHTML((r.recipients || '').split(',').map(s => s.trim()).filter(Boolean).join(', ') || '—')}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                  <button class="mc-btn mc-btn--sm" data-action="run" data-id="${r.id}">Run</button>
                  <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    wrap.innerHTML = `<div class="empty-state"><h3>Failed to load scheduled reports</h3></div>`;
  }
}


function render(mount) {
  mount.innerHTML = buildShell();
  bindEvents(mount);
  loadOverview(mount);
  loadScheduled(mount);
}

function buildShell() {
  return document.getElementById('reports-template')?.innerHTML || mount.innerHTML;
}

function bindEvents(mount) {
  mount.querySelectorAll('.reports-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mount.querySelectorAll('.reports-tab').forEach(t => t.classList.remove('active'));
      mount.querySelectorAll('.reports-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = mount.querySelector(`.reports-panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.classList.add('active');
    });
  });

  mount.querySelector('#new-scheduled-btn')?.addEventListener('click', () => {
    mount.querySelector('#scheduled-modal').style.display = 'flex';
  });

  mount.querySelector('#close-scheduled-modal')?.addEventListener('click', () => {
    mount.querySelector('#scheduled-modal').style.display = 'none';
  });

  mount.querySelector('#cancel-scheduled')?.addEventListener('click', () => {
    mount.querySelector('#scheduled-modal').style.display = 'none';
  });

  mount.querySelector('#scheduled-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      name: mount.querySelector('#sched-name')?.value.trim(),
      schedule: mount.querySelector('#sched-freq')?.value,
      source: mount.querySelector('#sched-source')?.value,
      recipients: mount.querySelector('#sched-recipients')?.value.trim(),
      columns: ['id', 'name', 'date', 'status'],
    };
    apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) })
      .then(() => {
        showToast('Scheduled report created', 'success');
        mount.querySelector('#scheduled-modal').style.display = 'none';
        mount.querySelector('#scheduled-form')?.reset();
        loadScheduled(mount);
      })
      .catch(err => showToast(err.message || 'Failed', 'error'));
  });

  mount.querySelector('#report-builder-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      name: mount.querySelector('#rpt-name')?.value.trim(),
      source: mount.querySelector('#rpt-source')?.value,
      columns: mount.querySelector('#rpt-cols')?.value.split(',').map(s => s.trim()).filter(Boolean),
      filters: parseJSON(mount.querySelector('#rpt-filters')?.value || '{}'),
      sort: mount.querySelector('#rpt-sort')?.value.trim(),
      limit: parseInt(mount.querySelector('#rpt-limit')?.value) || 100,
    };
    apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) })
      .then(data => {
        const result = mount.querySelector('#report-result');
        if (data && data.data) {
          result.innerHTML = `
            <h3>${escapeHTML(payload.name)} — ${data.data.length} rows</h3>
            <table><thead><tr>${payload.columns.map(c => `<th>${escapeHTML(c)}</th>`).join('')}</tr></thead>
            <tbody>${data.data.slice(0, 50).map(row => `<tr>${payload.columns.map(c => `<td>${escapeHTML(row[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
        } else {
          result.innerHTML = `<p>${escapeHTML(data?.error || 'No data returned')}</p>`;
        }
      })
      .catch(err => showToast(err.message || 'Failed', 'error'));
  });

  mount.querySelector('#preview-report')?.addEventListener('click', () => {
    const payload = {
      source: mount.querySelector('#rpt-source')?.value,
      columns: mount.querySelector('#rpt-cols')?.value.split(',').map(s => s.trim()).filter(Boolean),
      filters: parseJSON(mount.querySelector('#rpt-filters')?.value || '{}'),
      sort: mount.querySelector('#rpt-sort')?.value.trim(),
      limit: parseInt(mount.querySelector('#rpt-limit')?.value) || 100,
    };
    apiFetch('/reports', { method: 'POST', body: JSON.stringify({ ...payload, name: 'Preview' }) })
      .then(data => {
        const result = mount.querySelector('#report-result');
        if (data && data.data) {
          result.innerHTML = `
            <h3>Preview — ${data.data.length} rows</h3>
            <table><thead><tr>${payload.columns.map(c => `<th>${escapeHTML(c)}</th>`).join('')}</tr></thead>
            <tbody>${data.data.slice(0, 20).map(row => `<tr>${payload.columns.map(c => `<td>${escapeHTML(row[c] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>`;
        } else {
          result.innerHTML = `<p>${escapeHTML(data?.error || 'No data returned')}</p>`;
        }
      })
      .catch(err => showToast(err.message || 'Failed', 'error'));
  });

  mount.querySelector('#scheduled-table-wrap')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'run') {
      apiFetch(`/reports/scheduled/${id}/run`, { method: 'POST' })
        .then(data => {
          showToast('Report executed', 'success');
          const result = mount.querySelector('#report-result');
          if (data && data.data) {
            result.innerHTML = `<pre>${escapeHTML(JSON.stringify(data.data, null, 2))}</pre>`;
          }
        })
        .catch(err => showToast(err.message || 'Failed', 'error'));
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('Delete this scheduled report?')) return;
      apiFetch(`/reports/${id}`, { method: 'DELETE' })
        .then(() => {
          showToast('Deleted', 'success');
          loadScheduled(mount);
        })
        .catch(err => showToast(err.message || 'Failed', 'error'));
    }
  });
}

function parseJSON(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

function loadOverview(mount) {
  const grid = mount.querySelector('#reports-grid');
  if (!grid) return;
  const reportTemplates = [
    { icon: '👥', title: 'Patient Summary', desc: 'All registered patients with demographics', source: 'patients', columns: 'id, name, email, phone_number, gender, county' },
    { icon: '📅', title: 'Appointment Schedule', desc: 'Upcoming and past appointments', source: 'appointments', columns: 'id, time, type, status, patient_id' },
    { icon: '🩺', title: 'Encounter Log', desc: 'Clinical encounters with diagnoses', source: 'encounters', columns: 'id, patient_id, encounter_date, visit_type, diagnoses' },
    { icon: '🧪', title: 'Lab Results', desc: 'Lab orders with results', source: 'lab_orders', columns: 'id, patient_id, test_name, status, result_value, result_date' },
    { icon: '💊', title: 'Pharmacy Dispensing', desc: 'Medication dispensing records', source: 'pharmacy', columns: 'id, patient_id, drug_name, quantity, dispensed_at' },
    { icon: '💰', title: 'Financial Summary', desc: 'Invoices and payments', source: 'finance', columns: 'id, type, reference, amount, status, date' },
    { icon: '⚙️', title: 'Operations Tasks', desc: 'Task status and assignments', source: 'operations', columns: 'id, title, priority, status, assignee, due' },
    { icon: '📦', title: 'Inventory Status', desc: 'Stock levels and alerts', source: 'inventory', columns: 'id, name, category, current_stock, reorder_level, supplier' },
    { icon: '⏰', title: 'Attendance Report', desc: 'Clock in/out and hours', source: 'attendance', columns: 'id, user_id, date, clock_in, clock_out, total_hours, status' },
    { icon: '📅', title: 'Leave Summary', desc: 'Leave requests and approvals', source: 'leave', columns: 'id, user_id, leave_type, start_date, end_date, days_count, status' },
  ];

  grid.innerHTML = reportTemplates.map(t => `
    <div class="report-card" data-source="${t.source}" data-columns="${encodeURIComponent(t.columns)}">
      <div class="report-card__icon">${t.icon}</div>
      <div class="report-card__title">${escapeHTML(t.title)}</div>
      <div class="report-card__desc">${escapeHTML(t.desc)}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.report-card').forEach(card => {
    card.addEventListener('click', () => {
      const source = card.dataset.source;
      const columns = JSON.parse(decodeURIComponent(card.dataset.columns));
      mount.querySelector('#rpt-source').value = source;
      mount.querySelector('#rpt-cols').value = columns.join(', ');
      mount.querySelectorAll('.reports-tab').forEach(t => t.classList.remove('active'));
      mount.querySelectorAll('.reports-panel').forEach(p => p.classList.remove('active'));
      const builderTab = mount.querySelector('.reports-tab[data-tab="builder"]');
      const builderPanel = mount.querySelector('.reports-panel[data-panel="builder"]');
      if (builderTab) builderTab.classList.add('active');
      if (builderPanel) builderPanel.classList.add('active');
    });
  });
}

function loadScheduled(mount) {
  const wrap = mount.querySelector('#scheduled-table-wrap');
  const pg = mount.querySelector('#scheduled-pagination');
  try {
    const data = await apiFetch('/reports/scheduled?page=1&limit=25');
    const rows = data.data || [];
    if (rows.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><h3>No scheduled reports</h3><p>Create a scheduled report to automate data delivery.</p></div>`;
      pg.innerHTML = '';
      return;
    }
    wrap.innerHTML = `
      <div class="hr-table-wrap">
        <table class="hr-table">
          <thead><tr><th>Name</th><th>Source</th><th>Frequency</th><th>Recipients</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="font-weight-500">${escapeHTML(r.name)}</td>
                <td><span class="badge badge-neutral">${escapeHTML(r.source)}</span></td>
                <td>${escapeHTML(r.schedule || '—')}</td>
                <td>${escapeHTML((r.recipients || '').split(',').map(s => s.trim()).filter(Boolean).join(', ') || '—')}</td>
                <td>${formatDate(r.created_at)}</td>
                <td>
                  <button class="mc-btn mc-btn--sm" data-action="run" data-id="${r.id}">Run</button>
                  <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    wrap.innerHTML = `<div class="empty-state"><h3>Failed to load scheduled reports</h3></div>`;
  }
}
