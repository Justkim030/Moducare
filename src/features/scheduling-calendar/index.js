import { showToast, formatDate, formatDateTime, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
l.rel = 'stylesheet';
   l.href = '/src/features/scheduling-calendar/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

let _state = { view: 'week', currentDate: new Date(), events: [], appointments: [], editingId: null, editingSource: null };

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

function buildShell() {
  return `
  <div class="feature-scheduling">
    <div class="sched-header">
      <div>
        <h2 class="sched-title">Scheduling &amp; Calendar</h2>
        <p class="sched-subtitle">Manage staff schedules, shifts, and patient appointments.</p>
      </div>
      <button class="mc-btn icon-btn" id="sched-new-evt-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Event
      </button>
    </div>

    <div class="sched-controls">
      <div class="sched-tabs">
        <button class="sched-tab-btn active" data-view="week">Week View</button>
        <button class="sched-tab-btn" data-view="month">Month View</button>
        <button class="sched-tab-btn" data-view="day">Day View</button>
      </div>
      <div class="sched-search-wrapper">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="sched-search" placeholder="Search staff or event types..." />
      </div>
    </div>

    <div class="sched-calendar-card">
      <div class="sched-calendar-nav">
        <button class="mc-btn btn-ghost btn-sm" id="sched-prev">&larr;</button>
        <span class="sched-current-range" id="sched-range">Loading...</span>
        <button class="mc-btn btn-ghost btn-sm" id="sched-next">&rarr;</button>
      </div>
      <div id="sched-calendar-container"></div>
      <div id="sched-list-container" class="sched-list-wrap"></div>
    </div>

    <div id="sched-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <h2 id="sched-modal-title">New Event</h2>
          <button class="modal-close" id="close-sched-modal">&times;</button>
        </div>
        <form id="sched-form" class="sched-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Type</label>
              <select id="sched-event-type" class="input">
                <option value="shift">Staff Shift</option>
                <option value="meeting">Meeting</option>
                <option value="appointment">Appointment</option>
                <option value="holiday">Holiday</option>
                <option value="training">Training</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Status</label>
              <select id="sched-event-status" class="input">
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Title *</label>
            <input type="text" id="sched-event-title" class="input" required placeholder="e.g. Nursing Shift, Ward Meeting" />
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Start *</label>
              <input type="datetime-local" id="sched-event-start" class="input" required />
            </div>
            <div class="input-group">
              <label class="input-label">End</label>
              <input type="datetime-local" id="sched-event-end" class="input" />
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Assigned Staff</label>
            <select id="sched-event-staff" class="input">
              <option value="">-- Select Staff --</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Color</label>
            <select id="sched-event-color" class="input">
              <option value="#3b82f6">Blue</option>
              <option value="#10b981">Green</option>
              <option value="#f59e0b">Orange</option>
              <option value="#ec4899">Pink</option>
              <option value="#8b5cf6">Purple</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Description</label>
            <textarea id="sched-event-desc" class="input" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-sched">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Save Event</button>
          </div>
        </form>
      </div>
    </div>

    <div class="sched-legend">
      <div class="sched-legend-item"><span class="sched-dot" style="background:#3b82f6"></span> Appointment</div>
      <div class="sched-legend-item"><span class="sched-dot" style="background:#10b981"></span> Shift</div>
      <div class="sched-legend-item"><span class="sched-dot" style="background:#f59e0b"></span> Meeting</div>
      <div class="sched-legend-item"><span class="sched-dot" style="background:#ec4899"></span> Critical</div>
      <div class="sched-legend-item"><span class="sched-dot" style="background:#8b5cf6"></span> Training</div>
    </div>
  </div>`;
}

async function refreshAll(container) {
  await Promise.all([fetchEvents(container), fetchAppointments(container)]);
  renderCalendar(container);
}

async function fetchEvents(container) {
  try {
    const start = getRangeStart(_state.currentDate, _state.view);
    const end = getRangeEnd(_state.currentDate, _state.view);
    const data = await apiFetch(`/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    _state.events = data.events || [];
  } catch (err) {
    console.error('Failed to load events', err);
    _state.events = [];
  }
}

async function fetchAppointments(container) {
  try {
    const start = getRangeStart(_state.currentDate, _state.view);
    const end = getRangeEnd(_state.currentDate, _state.view);
    const data = await apiFetch(`/appointments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    _state.appointments = data.appointments || [];
  } catch (err) {
    console.error('Failed to load appointments', err);
    _state.appointments = [];
  }
}

function getRangeStart(date, view) {
  const d = new Date(date);
  if (view === 'month') {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (view === 'day') {
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getRangeEnd(date, view) {
  const d = new Date(date);
  if (view === 'month') {
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (view === 'day') {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff + 7);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function renderCalendar(container) {
  const calContainer = container.querySelector('#sched-calendar-container');
  const listContainer = container.querySelector('#sched-list-container');
  const rangeLabel = container.querySelector('#sched-range');
  if (!calContainer) return;

  const view = _state.view;
  const current = _state.currentDate;

  if (view === 'week') {
    rangeLabel.textContent = getWeekRangeLabel(current);
    calContainer.innerHTML = renderWeekView(current);
    bindWeekEvents(container);
  } else if (view === 'month') {
    rangeLabel.textContent = current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    calContainer.innerHTML = renderMonthView(current);
    bindMonthEvents(container);
  } else {
    rangeLabel.textContent = current.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    calContainer.innerHTML = renderDayView(current);
    bindDayEvents(container);
  }

  renderList(container);
  populateGridCells(container);
}

function getWeekRangeLabel(date) {
  const d = new Date(date);
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} — ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
}

function populateGridCells(container) {
  const view = _state.view;
  if (view === 'month') return;

  const combined = [
    ..._state.events.map(e => ({ ...e, source: 'event' })),
    ..._state.appointments.map(a => ({
      id: a.id, title: a.patient_name || 'Appointment', type: 'appointment', color: '#3b82f6',
      start_time: a.time, employee_id: a.employee_id, employee_name: a.provider_name, status: a.status, source: 'appointment'
    })),
  ];

  if (view === 'week') {
    const cells = container.querySelectorAll('.sched-week-cell');
    cells.forEach(cell => {
      const dateStr = cell.dataset.date;
      const hour = parseInt(cell.dataset.hour || '0', 10);
      const items = combined.filter(item => {
        if (toISODate(new Date(item.start_time)) !== dateStr) return false;
        const startHour = new Date(item.start_time).getHours();
        return startHour === hour;
      });
      items.forEach(item => {
        const block = document.createElement('div');
        block.className = 'sched-event-block';
        block.style.background = (item.color || '#3b82f6') + '22';
        block.style.color = item.color || '#3b82f6';
        block.style.borderLeftColor = item.color || '#3b82f6';
        block.textContent = item.title;
        cell.appendChild(block);
      });
    });
  } else if (view === 'day') {
    const cells = container.querySelectorAll('.sched-day-cell');
    cells.forEach(cell => {
      const dateStr = cell.dataset.date;
      const hour = parseInt(cell.dataset.hour || '0', 10);
      const items = combined.filter(item => {
        if (toISODate(new Date(item.start_time)) !== dateStr) return false;
        const startHour = new Date(item.start_time).getHours();
        return startHour === hour;
      });
      items.forEach(item => {
        const block = document.createElement('div');
        block.className = 'sched-day-event';
        block.style.background = (item.color || '#3b82f6') + '22';
        block.style.color = item.color || '#3b82f6';
        block.style.borderLeftColor = item.color || '#3b82f6';
        block.textContent = item.title;
        cell.appendChild(block);
      });
    });
  }
}

function renderWeekView(date) {
  const start = new Date(date);
  const diff = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);

  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const today = new Date();

  let html = '<div class="sched-week-grid">';
  html += '<div class="sched-week-header-row"><div class="sched-time-header"></div>';
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const isToday = isSameDay(d, today);
    html += `<div class="sched-day-header ${isToday ? 'is-today' : ''}">
      <div class="sched-day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
      <div class="sched-day-num">${d.getDate()}</div>
    </div>`;
  }
  html += '</div>';

  for (const h of hours) {
    html += '<div class="sched-week-body-row"><div class="sched-time-lbl">' + formatHour(h) + '</div>';
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(h, 0, 0, 0);
      html += `<div class="sched-week-cell" data-date="${toISODate(d)}" data-hour="${h}"></div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderMonthView(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let html = '<div class="sched-month-grid">';
  html += '<div class="sched-month-header-row">';
  for (const d of days) {
    html += `<div class="sched-month-day-header">${d}</div>`;
  }
  html += '</div><div class="sched-month-body">';

  let cellCount = 0;
  for (let i = 0; i < startDay; i++) {
    html += '<div class="sched-month-cell empty"></div>';
    cellCount++;
  }
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const isToday = isSameDay(d, today);
    const items = getEventsForDate(d);
    html += `<div class="sched-month-cell${isToday ? ' is-today' : ''}" data-date="${toISODate(d)}">
      <div class="sched-month-day-num">${day}</div>
      <div class="sched-month-events">${items.slice(0, 3).map(ev => `<div class="sched-month-chip" style="background:${(ev.color || '#3b82f6')}22;color:${ev.color || '#3b82f6'};border-left:3px solid ${ev.color || '#3b82f6'}">${escapeHTML(ev.title)}</div>`).join('')}</div>
      ${items.length > 3 ? `<div class="sched-month-more">+${items.length - 3} more</div>` : ''}
    </div>`;
    cellCount++;
  }
  while (cellCount % 7 !== 0) {
    html += '<div class="sched-month-cell empty"></div>';
    cellCount++;
  }
  html += '</div></div>';
  return html;
}

function renderDayView(date) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  let html = '<div class="sched-day-grid"><div class="sched-day-body">';
  for (const h of hours) {
    const d = new Date(date);
    d.setHours(h, 0, 0, 0);
    html += `<div class="sched-day-row">
      <div class="sched-time-lbl">${formatHour(h)}</div>
      <div class="sched-day-cell" data-date="${toISODate(d)}" data-hour="${h}"></div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

function getEventsForDate(date) {
  const iso = toISODate(date);
  const combined = [
    ..._state.events.filter(e => toISODate(new Date(e.start_time)) === iso).map(e => ({ ...e, source: 'event' })),
    ..._state.appointments.filter(a => toISODate(new Date(a.time)) === iso).map(a => ({
      id: a.id, title: a.patient_name || 'Appointment', type: 'appointment', color: '#3b82f6',
      start_time: a.time, employee_id: a.employee_id, employee_name: a.provider_name, status: a.status, source: 'appointment'
    }))
  ];
  return combined.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function renderList(container) {
  const listContainer = container.querySelector('#sched-list-container');
  if (!listContainer) return;

  const combined = [
    ..._state.events.map(e => ({ ...e, source: 'event' })),
    ..._state.appointments.map(a => ({
      ...a, source: 'appointment', title: a.patient_name || 'Appointment', type: 'appointment'
    })),
  ]
    .sort((a, b) => new Date(a.start_time || a.time) - new Date(b.start_time || b.time));

  if (combined.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><h3>No events found</h3><p>Add a new event or appointment to get started.</p></div>';
    return;
  }

  listContainer.innerHTML = `
    <div class="sched-list-table-wrap">
      <table class="mc-table sched-table">
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>Title</th>
            <th>Type</th>
            <th>Staff</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${combined.map(ev => `
            <tr>
              <td>${formatDateTime(ev.start_time || ev.time)}</td>
              <td><span class="sched-chip" style="background:${(ev.color || '#3b82f6')}22;color:${ev.color || '#3b82f6'};border-left:3px solid ${ev.color || '#3b82f6'}">${escapeHTML(ev.title)}</span></td>
              <td><span class="badge badge-neutral">${escapeHTML(ev.source === 'event' ? (ev.type || 'event') : 'appointment')}</span></td>
              <td>${escapeHTML(ev.employee_name || '—')}</td>
              <td>${renderStatus(ev.status)}</td>
              <td>
                <button class="mc-btn btn-ghost btn-sm sched-edit-btn" data-id="${ev.id}" data-source="${ev.source}">Edit</button>
                <button class="mc-btn btn-ghost btn-sm sched-delete-btn" data-id="${ev.id}" data-source="${ev.source}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  listContainer.querySelectorAll('.sched-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(container, btn.dataset.id, btn.dataset.source));
  });
  listContainer.querySelectorAll('.sched-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const source = btn.dataset.source;
      if (!confirm('Delete this item?')) return;
      try {
        if (source === 'event') {
          await apiFetch(`/events/${id}`, { method: 'DELETE' });
        } else {
          await apiFetch(`/appointments/${id}`, { method: 'DELETE' });
        }
        showToast('Deleted successfully', 'success');
        refreshAll(container);
      } catch (err) {
        showToast(err.message || 'Delete failed', 'error');
      }
    });
  });
}

function bindWeekEvents(container) {
  container.querySelectorAll('.sched-week-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.sched-event-block')) return;
      openCreateModal(container, cell.dataset.date);
    });
  });
}

function bindMonthEvents(container) {
  container.querySelectorAll('.sched-month-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => openCreateModal(container, cell.dataset.date));
  });
}

function bindDayEvents(container) {
  container.querySelectorAll('.sched-day-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.sched-day-event')) return;
      openCreateModal(container, cell.dataset.date);
    });
  });
}

function bindEvents(container) {
  container.querySelectorAll('.sched-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      container.querySelectorAll('.sched-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      _state.view = e.target.dataset.view;
      renderCalendar(container);
    });
  });

  container.querySelector('#sched-prev')?.addEventListener('click', () => navigateDate(container, -1));
  container.querySelector('#sched-next')?.addEventListener('click', () => navigateDate(container, 1));

  container.querySelector('#sched-new-evt-btn')?.addEventListener('click', () => openCreateModal(container));
  container.querySelector('#close-sched-modal')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#cancel-sched')?.addEventListener('click', () => closeModal(container));

  container.querySelector('#sched-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const rows = container.querySelectorAll('.sched-list-table-wrap tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });

  container.querySelector('#sched-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = container.querySelector('#sched-event-type').value;
    const title = container.querySelector('#sched-event-title').value;
    const start = container.querySelector('#sched-event-start').value;
    const end = container.querySelector('#sched-event-end').value;
    const status = container.querySelector('#sched-event-status').value;
    const employee_id = container.querySelector('#sched-event-staff').value;
    const color = container.querySelector('#sched-event-color').value;
    const description = container.querySelector('#sched-event-desc').value;

    try {
      if (_state.editingId && _state.editingSource === 'event') {
        await apiFetch(`/events/${_state.editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, description, start_time: new Date(start).toISOString(), end_time: end ? new Date(end).toISOString() : '', type, status, employee_id, color })
        });
        showToast('Event updated', 'success');
      } else if (type === 'appointment') {
        await apiFetch('/appointments', {
          method: 'POST',
          body: JSON.stringify({ time: new Date(start).toISOString(), patient_id: '', type: 'Consultation', status, employee_id, notes: description })
        });
        showToast('Appointment created', 'success');
      } else {
        await apiFetch('/events', {
          method: 'POST',
          body: JSON.stringify({ title, description, start_time: new Date(start).toISOString(), end_time: end ? new Date(end).toISOString() : '', type, status, employee_id, color })
        });
        showToast('Event created', 'success');
      }
      closeModal(container);
      refreshAll(container);
    } catch (err) {
      showToast(err.message || 'Save failed', 'error');
    }
  });
}

function navigateDate(container, direction) {
  const d = new Date(_state.currentDate);
  if (_state.view === 'month') {
    d.setMonth(d.getMonth() + direction);
  } else if (_state.view === 'day') {
    d.setDate(d.getDate() + direction);
  } else {
    d.setDate(d.getDate() + direction * 7);
  }
  _state.currentDate = d;
  renderCalendar(container);
}

async function openCreateModal(container, dateStr) {
  _state.editingId = null;
  _state.editingSource = null;
  container.querySelector('#sched-modal-title').textContent = 'New Event';
  const startInput = container.querySelector('#sched-event-start');
  const endInput = container.querySelector('#sched-event-end');
  container.querySelector('#sched-form')?.reset();
  container.querySelector('#sched-event-type').disabled = false;
  if (dateStr) {
    startInput.value = dateStr + 'T09:00';
    endInput.value = dateStr + 'T10:00';
  } else {
    startInput.value = '';
    endInput.value = '';
  }
  await populateStaffDropdown(container);
  container.querySelector('#sched-modal').style.display = 'flex';
}

async function openEditModal(container, id, source) {
  _state.editingId = id;
  _state.editingSource = source;
  await populateStaffDropdown(container);
  container.querySelector('#sched-event-type').disabled = false;

  if (source === 'appointment') {
    container.querySelector('#sched-modal-title').textContent = 'Edit Appointment';
    try {
      const data = await apiFetch(`/appointments/${id}`);
      const a = data.appointment;
      container.querySelector('#sched-event-title').value = a.patient_name || 'Appointment';
      container.querySelector('#sched-event-start').value = a.time ? new Date(a.time).toISOString().slice(0, 16) : '';
      container.querySelector('#sched-event-end').value = '';
      container.querySelector('#sched-event-status').value = a.status || 'scheduled';
      container.querySelector('#sched-event-staff').value = a.employee_id || '';
      container.querySelector('#sched-event-color').value = '#3b82f6';
      container.querySelector('#sched-event-desc').value = a.notes || '';
      container.querySelector('#sched-event-type').value = 'appointment';
      container.querySelector('#sched-event-type').disabled = true;
    } catch {
      showToast('Failed to load appointment', 'error');
      return;
    }
  } else {
    container.querySelector('#sched-modal-title').textContent = 'Edit Event';
    try {
      const data = await apiFetch(`/events/${id}`);
      const ev = data.event;
      container.querySelector('#sched-event-title').value = ev.title || '';
      container.querySelector('#sched-event-start').value = ev.start_time ? new Date(ev.start_time).toISOString().slice(0, 16) : '';
      container.querySelector('#sched-event-end').value = ev.end_time ? new Date(ev.end_time).toISOString().slice(0, 16) : '';
      container.querySelector('#sched-event-type').value = ev.type || 'shift';
      container.querySelector('#sched-event-status').value = ev.status || 'scheduled';
      container.querySelector('#sched-event-staff').value = ev.employee_id || '';
      container.querySelector('#sched-event-color').value = ev.color || '#3b82f6';
      container.querySelector('#sched-event-desc').value = ev.description || '';
    } catch {
      showToast('Failed to load event', 'error');
      return;
    }
  }
  container.querySelector('#sched-modal').style.display = 'flex';
}

function closeModal(container) {
  container.querySelector('#sched-modal').style.display = 'none';
  _state.editingId = null;
  _state.editingSource = null;
}

async function populateStaffDropdown(container) {
  const select = container.querySelector('#sched-event-staff');
  if (!select) return;
  try {
    const data = await apiFetch('/users');
    const users = data.users || [];
    select.innerHTML = '<option value="">-- Select Staff --</option>' +
      users.map(u => `<option value="${escapeHTML(u.id)}">${escapeHTML(u.name || u.email)}</option>`).join('');
  } catch {
    select.innerHTML = '<option value="">-- Select Staff --</option>';
  }
}

function renderStatus(s) {
  const map = { scheduled: 'badge-info', completed: 'badge-neutral', cancelled: 'badge-danger', 'checked-in': 'badge-success', 'no-show': 'badge-warning' };
  return `<span class="badge ${map[s] || 'badge-neutral'}">${escapeHTML(s || 'N/A')}</span>`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(d) {
  const dd = new Date(d);
  return dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
}

function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:00 ${ampm}`;
}
