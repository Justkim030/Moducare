/**
 * Dashboard Feature Logic
 * One unified dashboard for every user:
 *   - Tab 1 "Overview": stats + recent activity + quick incident report
 *   - Remaining tabs: the signed-in user's own role actions, each a single page
 *     (the per-user action tabs are the in-dashboard quick-navigation)
 */
import { apiFetch, escapeHTML, timeAgo, exportCSV } from '../../../js/utils.js';
import { getQuickActions, makeDashboardTabs } from '../../../js/auth.js';
import { showToast } from '../../../js/utils.js';

let allActivities = [];

export async function init(mount, State, subView) {
  const user = State?.getUser?.();
  const actions = getQuickActions(user?.role_id, user?.department_id);
  const tabs = makeDashboardTabs(user?.role_id, user?.department_id);

  let viewId = subView && subView !== 'dashboard'
    ? subView
    : (window.location.pathname.split('/')[2] || 'overview');
  if (!tabs.some(t => t.id === viewId)) viewId = 'overview';

  const title = mount.querySelector('#dashboard-title');
  const subtitle = mount.querySelector('#dashboard-subtitle');
  if (title) title.textContent = 'Dashboard';
  if (subtitle) subtitle.textContent = 'Your unified workspace — quick navigation and role actions.';

  renderTabs(mount, tabs, viewId);
  renderPanels(mount, tabs, actions);
  showPanel(mount, viewId);

  wireSidebarToggle(mount);
  await loadDashboardData(mount);

  return {
    destroy() {
      if (mount) mount.innerHTML = '';
    }
  };
}

/* ── Tabs ─────────────────────────────────────────────────── */
function renderTabs(mount, tabs, activeId) {
  const nav = mount.querySelector('#dashboard-tabs');
  if (!nav) return;
  nav.innerHTML = tabs.map(t => `
    <button type="button" class="dashboard-tab ${t.id === activeId ? 'active' : ''}"
            role="tab" aria-selected="${t.id === activeId}" data-tab="${t.id}">
      <span class="dashboard-tab__icon" aria-hidden="true">${t.icon}</span>
      <span>${escapeHTML(t.label)}</span>
    </button>`).join('');

  nav.querySelectorAll('.dashboard-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tab;
      nav.querySelectorAll('.dashboard-tab').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      showPanel(mount, id);
      history.pushState({}, '', `/dashboard/${id}`);
    });
  });
}

function showPanel(mount, id) {
  mount.querySelectorAll('.dashboard-panel').forEach(p => { p.hidden = p.dataset.panel !== id; });
}

/* ── Panels ───────────────────────────────────────────────── */
function renderPanels(mount, tabs, actions) {
  const host = mount.querySelector('#dashboard-panels');
  if (!host) return;
  host.innerHTML = tabs.map(t =>
    t.kind === 'overview' ? renderOverviewPanel(t) : renderActionPanel(t)
  ).join('');

  wireIncidentForm(host);
  wireActivitySearch(host);
  wireExportCSV(host);
}

function renderOverviewPanel(t) {
  return `
  <div class="dashboard-panel" data-panel="${t.id}" role="tabpanel">
    <div class="stats-summary" id="stats-summary">
      <div class="stat-card"><div class="stat-card__label">Patients</div><div class="stat-card__value" id="stat-patients">0</div></div>
      <div class="stat-card"><div class="stat-card__label">Appointments</div><div class="stat-card__value" id="stat-appointments">0</div></div>
      <div class="stat-card"><div class="stat-card__label">Open Incidents</div><div class="stat-card__value" id="stat-incidents">0</div></div>
      <div class="stat-card"><div class="stat-card__label">Notifications</div><div class="stat-card__value" id="stat-notifications">0</div></div>
    </div>

    <section class="card">
      <div class="section-header">
        <div class="section-title">Recent Activity</div>
        <div class="section-actions">
          <input id="activity-search" type="search" class="input" placeholder="Search activity...">
          <button id="export-csv" class="mc-btn">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody id="recent-body"><tr><td colspan="4" class="mc-muted">Loading...</td></tr></tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="section-header"><div class="section-title">Quick Incident Report</div></div>
      <form id="incident-form">
        <div class="form-grid">
          <div class="input-group"><label>Title<input id="inc-title" class="input" required></label></div>
          <div class="input-group"><label>Patient<input id="inc-patient" class="input"></label></div>
          <div class="input-group"><label>Severity<select id="inc-severity" class="input"><option>S3</option><option>S2</option><option>S1</option></select></label></div>
          <button type="submit" class="mc-btn btn-primary">Submit Report</button>
        </div>
      </form>
    </section>
  </div>`;
}

function renderActionPanel(t) {
  return `
  <div class="dashboard-panel" data-panel="${t.id}" role="tabpanel" hidden>
    <section class="card dashboard-action-panel">
      <div class="section-header">
        <div class="section-title">
          <span class="dashboard-action-panel__icon" aria-hidden="true">${t.icon}</span>
          ${escapeHTML(t.label)}
        </div>
      </div>
      <p class="dashboard-action-panel__desc">
        A focused single-page view for <strong>${escapeHTML(t.label)}</strong>.
        Open the full workspace to perform this action.
      </p>
      <a href="${t.route || '#'}" data-route class="mc-btn btn-primary">Open ${escapeHTML(t.label)}</a>
    </section>
  </div>`;
}

/* ── Data ─────────────────────────────────────────────────── */
async function loadDashboardData(mount) {
  try {
    const result = await apiFetch('/dashboard');
    const stats = result.stats || {};
    const setStat = (id, val) => { const el = mount.querySelector(`#${id}`); if (el) el.textContent = val ?? 0; };
    setStat('stat-patients', stats.patients);
    setStat('stat-appointments', stats.appointments);
    setStat('stat-incidents', stats.incidents);
    setStat('stat-notifications', stats.notifications);
    loadActivities(mount);
  } catch (err) {
    console.error('Dashboard: Data load failed', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

function wireSidebarToggle(mount) {
  const btn = mount.querySelector('#left-collapse');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const sidebar = document.querySelector('.mc-sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
  });
}

/* ── Recent Activity ──────────────────────────────────────── */
async function loadActivities(mount, filter = '') {
  try {
    const data = await apiFetch('/activities');
    allActivities = Array.isArray(data) ? data : (data?.activities || []);
    const body = mount.querySelector('#recent-body');
    if (!body) return;
    const term = filter.toLowerCase();
    const filtered = term
      ? allActivities.filter(a => (a.action || '').toLowerCase().includes(term) || (a.details || '').toLowerCase().includes(term) || (a.user || 'System').toLowerCase().includes(term))
      : allActivities;
    body.innerHTML = filtered.length > 0
      ? filtered.slice(0, 20).map(a => `
          <tr>
            <td>${timeAgo(a.time || a.created)}</td>
            <td>${escapeHTML(a.user || 'System')}</td>
            <td>${escapeHTML(a.action)}</td>
            <td><span class="mc-muted">${escapeHTML(a.details || '')}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="mc-muted">No activity found.</td></tr>';
  } catch {
    const body = mount.querySelector('#recent-body');
    if (body) body.innerHTML = '<tr><td colspan="4" class="mc-muted">Failed to load activity.</td></tr>';
  }
}

function wireActivitySearch(mount) {
  const input = mount.querySelector('#activity-search');
  if (!input) return;
  input.addEventListener('input', () => loadActivities(mount, input.value));
}

function wireExportCSV(mount) {
  const btn = mount.querySelector('#export-csv');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!allActivities.length) { showToast('No data to export', 'warning'); return; }
    const rows = allActivities.slice(0, 100).map(a => [a.time || a.created, a.user || 'System', a.action, a.details || '']);
    rows.unshift(['Time', 'User', 'Action', 'Details']);
    exportCSV(rows, 'dashboard_activity.csv');
    showToast('Activity exported', 'success');
  });
}

function wireIncidentForm(mount) {
  const form = mount.querySelector('#incident-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = mount.querySelector('#inc-title')?.value.trim();
    const patient = mount.querySelector('#inc-patient')?.value.trim();
    const severity = mount.querySelector('#inc-severity')?.value || 'S3';
    if (!title) { showToast('Title is required', 'error'); return; }
    try {
      await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify({ title, description: patient ? `Patient: ${patient}` : '', status: 'Reported', severity })
      });
      showToast('Quick report submitted', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message || 'Failed to submit report', 'error');
    }
  });
}
