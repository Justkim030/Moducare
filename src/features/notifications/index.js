/**
 * ModuCare MS — Notifications Module
 * Features: Notification list, read/unread, send SMS/WhatsApp reminders
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/notifications/styles.css';
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
  <div class="notif-layout">
    <div class="notif-header">
      <h1>🔔 Notifications</h1>
      <button class="mc-btn btn-primary" id="new-notif-btn">+ New Notification</button>
    </div>
    <div class="notif-filters">
      <select id="notif-filter-unread" class="input" style="width:auto;">
        <option value="">All</option>
        <option value="true">Unread Only</option>
      </select>
    </div>
    <div id="notif-list"></div>

    <div id="notif-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header">
          <h2>Send Notification</h2>
          <button class="modal-close" id="close-notif-modal">&times;</button>
        </div>
        <form id="notif-form" class="notif-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="notif-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Type</label>
              <select id="notif-type" class="input">
                <option value="reminder">Reminder</option>
                <option value="result">Lab Result</option>
                <option value="appointment">Appointment</option>
                <option value="general">General</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Channel</label>
              <select id="notif-channel" class="input">
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="in-app">In-App</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Subject</label>
            <input type="text" id="notif-subject" class="input" placeholder="Notification subject">
          </div>
          <div class="input-group">
            <label class="input-label">Message</label>
            <textarea id="notif-body" class="input" rows="3" placeholder="Notification message..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-notif">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Send Notification</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#notif-list');
  if (!list) return;
  const unread = container.querySelector('#notif-filter-unread')?.value || '';
  const qs = unread ? `?unread=${unread}` : '';
  const data = await apiFetch(`/notifications${qs}`);
  const notifs = data.notifications || [];
  if (notifs.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No notifications</h3><p>Send a notification to get started.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="notif-table-wrap">
      <table class="mc-table notif-table">
        <thead>
          <tr>
            <th>Sent</th>
            <th>Patient</th>
            <th>Type</th>
            <th>Channel</th>
            <th>Subject</th>
            <th>Read</th>
          </tr>
        </thead>
        <tbody>
          ${notifs.map(n => `
            <tr class="${n.read_at ? '' : 'unread-row'}">
              <td>${formatDate(n.sent_at)}</td>
              <td>${escapeHTML(n.patient_name || 'Unknown')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(n.type)}</span></td>
              <td>${escapeHTML(n.channel)}</td>
              <td>${escapeHTML(n.subject || '—')}</td>
              <td>${n.read_at ? formatDate(n.read_at) : '⏰ Unread'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

async function bindEvents(container) {
  const modal = container.querySelector('#notif-modal');
  const form = container.querySelector('#notif-form');

  container.querySelector('#new-notif-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-notif-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-notif')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#notif-patient')?.value,
      type: container.querySelector('#notif-type')?.value,
      channel: container.querySelector('#notif-channel')?.value,
      subject: container.querySelector('#notif-subject')?.value,
      body: container.querySelector('#notif-body')?.value,
    };
    try {
      await apiFetch('/notifications', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Notification sent', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to send notification', 'error');
    }
  });

  container.querySelector('#notif-filter-unread')?.addEventListener('change', () => refreshList(container));
}

async function populatePatients(container) {
  const select = container.querySelector('#notif-patient');
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
