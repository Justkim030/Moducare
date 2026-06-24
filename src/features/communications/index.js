/**
 * ModuCare MS — Communications Module
 * Features: Secure messaging, referral coordination
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/communications/styles.css';
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
  <div class="comm-layout">
    <div class="comm-header">
      <h1>💬 Communications</h1>
      <button class="mc-btn btn-primary" id="new-comm-btn">+ New Message</button>
    </div>
    <div id="comm-list"></div>

    <div id="comm-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header">
          <h2>New Message</h2>
          <button class="modal-close" id="close-comm-modal">&times;</button>
        </div>
        <form id="comm-form" class="comm-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="comm-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Channel</label>
              <select id="comm-channel" class="input">
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="in-app">In-App</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Subject</label>
            <input type="text" id="comm-subject" class="input" placeholder="Message subject">
          </div>
          <div class="input-group">
            <label class="input-label">Message</label>
            <textarea id="comm-body" class="input" rows="4" placeholder="Type your message..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-comm">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Send Message</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#comm-list');
  if (!list) return;
  const data = await apiFetch('/notifications');
  const comms = data.notifications || [];
  if (comms.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No messages</h3><p>Start a new conversation.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="comm-table-wrap">
      <table class="mc-table comm-table">
        <thead>
          <tr>
            <th>Sent</th>
            <th>Patient</th>
            <th>Channel</th>
            <th>Subject</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${comms.map(c => `
            <tr>
              <td>${formatDate(c.sent_at)}</td>
              <td>${escapeHTML(c.patient_name || 'Unknown')}</td>
              <td>${escapeHTML(c.channel)}</td>
              <td>${escapeHTML(c.subject || '—')}</td>
              <td>${c.read_at ? 'Read' : 'Sent'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

async function bindEvents(container) {
  const modal = container.querySelector('#comm-modal');
  const form = container.querySelector('#comm-form');

  container.querySelector('#new-comm-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-comm-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-comm')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#comm-patient')?.value,
      type: 'general',
      channel: container.querySelector('#comm-channel')?.value,
      subject: container.querySelector('#comm-subject')?.value,
      body: container.querySelector('#comm-body')?.value,
    };
    try {
      await apiFetch('/notifications', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Message sent', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
    }
  });
}

async function populatePatients(container) {
  const select = container.querySelector('#comm-patient');
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
