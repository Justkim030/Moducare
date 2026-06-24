/**
 * ModuCare MS — Appointments & Reminders Module
 * Features: Appointment scheduling, reminder tracking, recall system
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/appointments/styles.css';
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
  <div class="appt-layout">
    <div class="appt-header">
      <h1>📅 Appointments & Reminders</h1>
      <button class="mc-btn btn-primary" id="new-appt-btn">+ New Appointment</button>
    </div>
    <div class="appt-filters">
      <select id="appt-filter-status" class="input" style="width:auto;">
        <option value="">All Status</option>
        <option value="scheduled">Scheduled</option>
        <option value="checked-in">Checked In</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="no-show">No Show</option>
      </select>
      <button class="mc-btn btn-ghost btn-sm" id="send-reminders-btn">📲 Send Reminders</button>
    </div>
    <div id="appt-list"></div>

    <div id="appt-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header">
          <h2>New Appointment</h2>
          <button class="modal-close" id="close-appt-modal">&times;</button>
        </div>
        <form id="appt-form" class="appt-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="appt-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Date & Time *</label>
              <input type="datetime-local" id="appt-time" class="input" required>
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Type</label>
              <select id="appt-type" class="input">
                <option value="Consultation">Consultation</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Lab">Lab</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Emergency">Emergency</option>
                <option value="Home Visit">Home Visit</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Provider</label>
              <select id="appt-provider" class="input">
                <option value="">-- Select Provider --</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Reminder Due</label>
              <input type="datetime-local" id="appt-reminder" class="input">
            </div>
            <div class="input-group">
              <label class="input-label">Status</label>
              <select id="appt-status" class="input">
                <option value="scheduled">Scheduled</option>
                <option value="checked-in">Checked In</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Notes</label>
            <textarea id="appt-notes" class="input" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-appt">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Save Appointment</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#appt-list');
  if (!list) return;
  const status = container.querySelector('#appt-filter-status')?.value || '';
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await apiFetch(`/appointments${qs}`);
  const appts = data.appointments || [];
  if (appts.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No appointments found</h3><p>Schedule a new appointment to get started.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="appt-table-wrap">
      <table class="mc-table appt-table">
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>Patient</th>
            <th>Type</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Reminder</th>
          </tr>
        </thead>
        <tbody>
          ${appts.map(a => `
            <tr>
              <td>${formatDate(a.time)}</td>
              <td>${escapeHTML(a.patient_name || 'Unknown')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(a.type || 'N/A')}</span></td>
              <td>${escapeHTML(a.provider_name || 'Unassigned')}</td>
              <td>${renderStatus(a.status)}</td>
              <td>${a.reminder_due ? formatDate(a.reminder_due) + (a.reminder_sent ? ' ✅' : ' ⏰') : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderStatus(s) {
  const map = { scheduled: 'badge-info', 'checked-in': 'badge-success', completed: 'badge-neutral', cancelled: 'badge-danger', 'no-show': 'badge-warning' };
  return `<span class="badge ${map[s] || 'badge-neutral'}">${escapeHTML(s || 'N/A')}</span>`;
}

async function bindEvents(container) {
  const modal = container.querySelector('#appt-modal');
  const form = container.querySelector('#appt-form');

  container.querySelector('#new-appt-btn')?.addEventListener('click', async () => {
    await populateDropdowns(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-appt-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-appt')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const timeVal = container.querySelector('#appt-time')?.value;
    const dt = timeVal ? new Date(timeVal).toISOString() : new Date().toISOString();
    const reminderVal = container.querySelector('#appt-reminder')?.value;
    const payload = {
      time: dt,
      patient_id: container.querySelector('#appt-patient')?.value,
      type: container.querySelector('#appt-type')?.value,
      status: container.querySelector('#appt-status')?.value,
      employee_id: container.querySelector('#appt-provider')?.value,
      reminder_due: reminderVal ? new Date(reminderVal).toISOString() : '',
      notes: container.querySelector('#appt-notes')?.value,
    };
    try {
      await apiFetch('/appointments', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Appointment scheduled', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to create appointment', 'error');
    }
  });

  container.querySelector('#send-reminders-btn')?.addEventListener('click', async () => {
    try {
      await apiFetch('/notifications/broadcast', { method: 'POST', body: JSON.stringify({ type: 'reminder', channel: 'sms' }) });
      showToast('Reminders sent', 'success');
    } catch {
      showToast('Failed to send reminders', 'error');
    }
  });

  container.querySelector('#appt-filter-status')?.addEventListener('change', () => refreshList(container));
}

async function populateDropdowns(container) {
  const patientSelect = container.querySelector('#appt-patient');
  const providerSelect = container.querySelector('#appt-provider');
  if (!patientSelect || !providerSelect) return;
  try {
    const [patientsRes, staffRes] = await Promise.all([
      apiFetch('/patients'),
      apiFetch('/users'),
    ]);
    const patients = patientsRes.patients || [];
    const staff = staffRes.users || [];
    patientSelect.innerHTML = '<option value="">-- Select Patient --</option>' +
      patients.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.email || 'no email')})</option>`).join('');
    providerSelect.innerHTML = '<option value="">-- Select Provider --</option>' +
      staff.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
  } catch {
    showToast('Failed to load dropdown data', 'error');
  }
}
