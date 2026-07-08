/**
 * Dashboard Feature Logic
 * Fully wired sub-views: Overview, Tasks, Calendar, Financial KPIs.
 */
import { apiFetch, escapeHTML, formatCurrency, timeAgo, exportCSV } from '../../../js/utils.js';
import { getDashboardProfile } from '../../../js/auth.js';
import { showToast } from '../../../js/utils.js';

let allActivities = [];
let allOperations = [];
let allAppointments = [];

export async function init(mount, State, subView) {
  const path = window.location.pathname;
  const segments = path.split('/');
  const viewId = subView && subView !== 'dashboard' ? subView : (segments[2] || 'overview');

  const user = State?.getUser?.();
  const profile = getDashboardProfile(user?.role_id, user?.department_id);

  const title = mount.querySelector('#dashboard-title');
  const subtitle = mount.querySelector('#dashboard-subtitle');
  if (title) title.textContent = profile.title;
  if (subtitle) subtitle.textContent = profile.description;

  renderRoleCards(mount, profile.cards);
  switchView(mount, viewId);

  wireSidebarToggle(mount);
  await loadDashboardData(mount, viewId);

  return {
    destroy() {
      if (mount) mount.innerHTML = '';
    }
  };
}

function renderRoleCards(mount, cards) {
  const grid = mount.querySelector('#role-cards');
  if (!grid) return;
  grid.innerHTML = cards.map(card => `
    <a href="${card.route}" data-route class="role-card" title="${escapeHTML(card.title)}">
      <span class="role-card__icon">${card.icon}</span>
      <span class="role-card__title">${escapeHTML(card.title)}</span>
      <span class="role-card__metric" data-metric="${card.data}">0</span>
    </a>
  `).join('');
}

function switchView(mount, viewId) {
  mount.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
  const target = mount.querySelector(`#view-${viewId}`) || mount.querySelector('#view-overview');
  if (target) target.classList.add('active');

  const title = mount.querySelector('#dashboard-title');
  if (title && viewId !== 'overview') {
    const labels = { tasks: 'Tasks', calendar: 'Calendar', 'kpi-1': 'Financial Metrics' };
    title.textContent = `Dashboard / ${labels[viewId] || viewId}`;
  }
}

async function loadDashboardData(mount, viewId) {
  try {
    const result = await apiFetch('/dashboard');
    const stats = result.stats || {};

    // Role card metrics
    document.querySelectorAll('.role-card__metric').forEach(el => {
      const key = el.dataset.metric;
      if (stats[key] !== undefined) {
        const value = stats[key];
        el.textContent = key === 'finance'
          ? formatCurrency(value)
          : value + (key === 'notifications' ? ' new' : key === 'documents' ? ' pending' : key.includes('Tasks') ? ' open' : '');
      }
    });

    // Stats summary bar
    const setStat = (id, val) => { const el = mount.querySelector(`#${id}`); if (el) el.textContent = val ?? 0; };
    setStat('stat-patients', stats.patients);
    setStat('stat-appointments', stats.appointments);
    setStat('stat-incidents', stats.incidents);
    setStat('stat-notifications', stats.notifications);

    if (viewId === 'overview') initOverview(mount);
    if (viewId === 'tasks') initTasks(mount);
    if (viewId === 'calendar') initCalendar(mount);
    if (viewId === 'kpi-1') initKPI(mount);
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

/* ================================================================
   OVERVIEW
   ================================================================ */
function initOverview(mount) {
  loadActivities(mount);
  wireIncidentForm(mount);
  wireActivitySearch(mount);
  wireExportCSV(mount);
}

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

/* ================================================================
   TASKS
   ================================================================ */
function initTasks(mount) {
  loadOperations(mount);
  const filterEl = mount.querySelector('#task-filter');
  if (filterEl) {
    filterEl.addEventListener('change', () => {
      taskFilterState = filterEl.value;
      renderOperations(mount);
    });
  }
  const newBtn = mount.querySelector('#new-task-btn');
  if (newBtn) newBtn.addEventListener('click', () => openTaskModal(mount));
  wireTaskModal(mount);
}

let taskFilterState = 'all';

async function loadOperations(mount) {
  try {
    const data = await apiFetch('/operations');
    allOperations = Array.isArray(data) ? data : (data?.operations || []);
    renderOperations(mount);
  } catch {
    showToast('Failed to load tasks', 'error');
  }
}

function renderOperations(mount) {
  const list = mount.querySelector('#task-list');
  if (!list) return;
  const filtered = taskFilterState === 'all' ? allOperations : allOperations.filter(o => o.status === taskFilterState);
  if (!filtered.length) {
    list.innerHTML = '<p class="mc-muted">No tasks found.</p>';
    return;
  }
  list.innerHTML = filtered.map(op => `
    <div class="task-card" data-id="${op.id}">
      <div class="task-card__main">
        <div class="task-card__title">${escapeHTML(op.title)}</div>
        <div class="task-card__desc">${escapeHTML(op.description || '')}</div>
        <div class="task-card__meta">
          <span class="task-badge task-badge--${op.status || 'pending'}">${op.status || 'pending'}</span>
          <span class="task-badge task-badge--priority-${op.priority || 'medium'}">${op.priority || 'medium'}</span>
          ${op.due ? `<span style="font-size:12px;color:var(--text-tertiary)">Due: ${escapeHTML(op.due)}</span>` : ''}
          ${op.owner ? `<span style="font-size:12px;color:var(--text-tertiary)">${escapeHTML(op.owner)}</span>` : ''}
        </div>
      </div>
      <div class="task-card__actions">
        ${op.status !== 'completed'
          ? `<button class="mc-btn btn-complete" data-id="${op.id}">Complete</button>`
          : `<button class="mc-btn btn-reopen" data-id="${op.id}">Reopen</button>`
        }
        <button class="mc-btn btn-delete-task" data-id="${op.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', () => toggleTaskStatus(mount, btn.dataset.id, 'completed'));
  });
  list.querySelectorAll('.btn-reopen').forEach(btn => {
    btn.addEventListener('click', () => toggleTaskStatus(mount, btn.dataset.id, 'active'));
  });
  list.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(mount, btn.dataset.id));
  });
}

async function toggleTaskStatus(mount, id, status) {
  try {
    await apiFetch(`/operations/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    showToast(`Task marked as ${status}`, 'success');
    await loadOperations(mount);
  } catch (err) {
    showToast(err.message || 'Failed to update task', 'error');
  }
}

async function deleteTask(mount, id) {
  if (!confirm('Delete this task?')) return;
  try {
    await apiFetch(`/operations/${id}`, { method: 'DELETE' });
    showToast('Task deleted', 'success');
    await loadOperations(mount);
  } catch (err) {
    showToast(err.message || 'Failed to delete task', 'error');
  }
}

function openTaskModal(mount) {
  const modal = mount.querySelector('#task-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const title = mount.querySelector('#modal-task-title');
  if (title) title.textContent = 'New Task';
}

function wireTaskModal(mount) {
  const modal = mount.querySelector('#task-modal');
  const closeBtn = mount.querySelector('#task-modal-close');
  const cancelBtn = mount.querySelector('#task-modal-cancel');
  const form = mount.querySelector('#task-form');
  if (!modal) return;

  const close = () => modal.classList.add('hidden');
  closeBtn?.addEventListener('click', close);
  cancelBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = mount.querySelector('#task-title')?.value.trim();
    const description = mount.querySelector('#task-desc')?.value.trim();
    const priority = mount.querySelector('#task-priority')?.value || 'medium';
    const due = mount.querySelector('#task-due')?.value || '';
    const assignee = mount.querySelector('#task-assignee')?.value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    try {
      await apiFetch('/operations', {
        method: 'POST',
        body: JSON.stringify({ title, description, priority, due, assignee, status: 'active' })
      });
      showToast('Task created', 'success');
      form.reset();
      close();
      await loadOperations(mount);
    } catch (err) {
      showToast(err.message || 'Failed to create task', 'error');
    }
  });
}

/* ================================================================
   CALENDAR
   ================================================================ */
let calendarState = { year: 0, month: 0, selectedDate: '' };

function initCalendar(mount) {
  const now = new Date();
  calendarState = { year: now.getFullYear(), month: now.getMonth(), selectedDate: '' };
  const prev = mount.querySelector('#cal-prev');
  const next = mount.querySelector('#cal-next');
  if (prev) prev.onclick = () => navigateMonth(mount, -1);
  if (next) next.onclick = () => navigateMonth(mount, 1);
  renderCalendar(mount);
  loadAppointments(mount);
}

async function loadAppointments(mount) {
  try {
    const data = await apiFetch('/appointments');
    allAppointments = Array.isArray(data) ? data : (data?.appointments || []);
    renderCalendar(mount);
  } catch {
    showToast('Failed to load appointments', 'error');
  }
}

function navigateMonth(mount, delta) {
  calendarState.month += delta;
  if (calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
  if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
  renderCalendar(mount);
}

function renderCalendar(mount) {
  const label = mount.querySelector('#cal-month');
  if (label) label.textContent = new Date(calendarState.year, calendarState.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const container = mount.querySelector('#calendar-days');
  if (!container) return;

  const firstDay = new Date(calendarState.year, calendarState.month, 1).getDay();
  const daysInMonth = new Date(calendarState.year, calendarState.month + 1, 0).getDate();
  const daysInPrev = new Date(calendarState.year, calendarState.month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const apptDates = new Set(allAppointments.map(a => {
    const d = new Date(a.time || a.created);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }));

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, muted: true, date: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarState.year}-${String(calendarState.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, muted: false, date: dateStr, isToday: dateStr === todayStr, hasAppts: apptDates.has(dateStr), selected: dateStr === calendarState.selectedDate });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, muted: true, date: '' });

  container.innerHTML = cells.map(c => {
    const cls = ['calendar-day'];
    if (c.muted) cls.push('calendar-day--muted');
    if (c.isToday) cls.push('calendar-day--today');
    if (c.selected) cls.push('calendar-day--selected');
    if (c.hasAppts) cls.push('calendar-day--has-appts');
    return `<div class="${cls.join(' ')}" data-date="${c.date}"><span class="cal-day-number">${c.day}</span></div>`;
  }).join('');

  container.querySelectorAll('.calendar-day:not(.calendar-day--muted)').forEach(cell => {
    cell.addEventListener('click', () => {
      calendarState.selectedDate = cell.dataset.date;
      renderCalendar(mount);
      renderAppointmentsSidebar(mount);
    });
  });

  if (calendarState.selectedDate) renderAppointmentsSidebar(mount);
}

function renderAppointmentsSidebar(mount) {
  const dateLabel = mount.querySelector('#cal-sidebar-date');
  const container = mount.querySelector('#calendar-appointments');
  if (!container || !calendarState.selectedDate) return;

  const [y, m, d] = calendarState.selectedDate.split('-').map(Number);
  if (dateLabel) dateLabel.textContent = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const dayAppts = allAppointments
    .filter(a => { const dt = new Date(a.time || a.created); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d; })
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  if (!dayAppts.length) {
    container.innerHTML = '<p class="mc-muted">No appointments on this date.</p>';
    return;
  }

  container.innerHTML = dayAppts.map(a => {
    const t = new Date(a.time || a.created);
    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="calendar-appt-card">
      <div class="calendar-appt-card__title">${escapeHTML(a.type || a.patient_name || 'Appointment')}</div>
      <div class="calendar-appt-card__meta">${timeStr}${a.status ? ` · ${escapeHTML(a.status)}` : ''}${a.provider_name ? ` · ${escapeHTML(a.provider_name)}` : ''}</div>
    </div>`;
  }).join('');
}

/* ================================================================
   KPI / FINANCIAL
   ================================================================ */
function initKPI(mount) {
  loadFinance(mount);
}

async function loadFinance(mount) {
  try {
    const data = await apiFetch('/finance');
    financeRecords = Array.isArray(data) ? data : (data?.records || []);
    renderKPI(mount);
  } catch {
    showToast('Failed to load financial data', 'error');
  }
}

function renderKPI(mount) {
  const revenue = financeRecords.filter(r => r.status === 'paid').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const costs = financeRecords.filter(r => r.status === 'pending').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const pendingCount = financeRecords.filter(r => r.status === 'pending').length;
  const paidCount = financeRecords.filter(r => r.status === 'paid').length;

  const setText = (id, val) => { const el = mount.querySelector(`#${id}`); if (el) el.textContent = val; };
  setText('kpi-revenue', formatCurrency(revenue));
  setText('kpi-costs', formatCurrency(costs));
  setText('kpi-pending', pendingCount);
  setText('kpi-paid', paidCount);

  const barsContainer = mount.querySelector('#kpi-bars');
  if (!barsContainer) return;

  const monthly = {};
  financeRecords.forEach(r => {
    const d = new Date(r.date || r.created || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[key]) monthly[key] = { revenue: 0, costs: 0, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) };
    if (r.status === 'paid') monthly[key].revenue += Number(r.amount) || 0;
    else monthly[key].costs += Number(r.amount) || 0;
  });

  const months = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  if (!months.length) {
    barsContainer.innerHTML = '<p class="mc-muted">No financial data available.</p>';
    return;
  }

  const maxVal = Math.max(...months.map(([, m]) => Math.max(m.revenue, m.costs)), 1);
  barsContainer.innerHTML = months.map(([key, m]) => {
    const revH = Math.max((m.revenue / maxVal) * 100, 2);
    const costH = Math.max((m.costs / maxVal) * 100, 2);
    return `<div class="kpi-bar">
      <div class="kpi-bar__value">${formatCurrency(m.revenue)}</div>
      <div class="kpi-bar__fill" style="height:${revH}%"></div>
      <div class="kpi-bar__label">${m.label}</div>
      <div class="kpi-bar__fill" style="height:${costH}%;background:linear-gradient(180deg,#F59E0B 0%,rgba(245,158,11,0.25) 100%)"></div>
    </div>`;
  }).join('');
}
