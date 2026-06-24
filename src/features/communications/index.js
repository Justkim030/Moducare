/**
 * ModuCare MS — Communications Module
 * Features: Secure messaging threads, referral coordination
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

let _state = { currentPatientId: null, messages: [] };

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshThreadList(container);
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
      <button class="mc-btn btn-primary" id="new-comm-btn">+ New Thread</button>
    </div>
    <div class="comm-split">
      <div class="comm-sidebar">
        <div class="comm-sidebar-header">
          <input type="search" id="comm-patient-search" class="input" placeholder="Search patient..." />
        </div>
        <div id="thread-list" class="thread-list"></div>
      </div>
      <div class="thread-view">
        <div id="thread-empty" class="empty-state">
          <h3>Select a conversation</h3>
          <p>Choose a patient from the left to view messages, or start a new thread.</p>
        </div>
        <div id="thread-content" style="display:none;">
          <div class="thread-header">
            <h3 id="thread-patient-name">Patient</h3>
            <span class="badge badge-neutral" id="thread-patient-id"></span>
          </div>
          <div id="thread-messages" class="thread-messages"></div>
          <div class="thread-composer">
            <textarea id="thread-input" class="input" rows="2" placeholder="Type a message..."></textarea>
            <div class="thread-composer-actions">
              <select id="thread-channel" class="input" style="width:auto;">
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="in-app">In-App</option>
              </select>
              <button class="mc-btn btn-primary btn-sm" id="thread-send">Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="comm-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h2>New Message Thread</h2>
          <button class="modal-close" id="close-comm-modal">&times;</button>
        </div>
        <form id="comm-form" class="comm-form">
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
          <div class="input-group">
            <label class="input-label">Initial Message</label>
            <textarea id="comm-body" class="input" rows="3" placeholder="Type your message..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-comm">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Start Thread</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshThreadList(container) {
  const list = container.querySelector('#thread-list');
  if (!list) return;
  try {
    const data = await apiFetch('/patients');
    const patients = data.patients || [];
    list.innerHTML = patients.map(p => `
      <div class="thread-item" data-patient-id="${escapeHTML(p.id)}">
        <div class="thread-item-avatar">${escapeHTML(p.name.charAt(0))}</div>
        <div class="thread-item-info">
          <div class="thread-item-name">${escapeHTML(p.name)}</div>
          <div class="thread-item-meta">${escapeHTML(p.email || p.phone_number || '')}</div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.thread-item').forEach(item => {
      item.addEventListener('click', () => openThread(container, item.dataset.patientId));
    });
  } catch {
    list.innerHTML = '<div class="empty-state"><p>Failed to load patients.</p></div>';
  }
}

async function openThread(container, patientId) {
  _state.currentPatientId = patientId;
  container.querySelector('#thread-empty').style.display = 'none';
  container.querySelector('#thread-content').style.display = 'flex';
  container.querySelectorAll('.thread-item').forEach(el => el.classList.toggle('active', el.dataset.patientId === patientId));

  try {
    const data = await apiFetch(`/notifications?patient_id=${encodeURIComponent(patientId)}`);
    const notifs = data.notifications || [];
    const patientData = await apiFetch(`/patients/${patientId}`);
    const patient = patientData.patient || {};
    container.querySelector('#thread-patient-name').textContent = patient.name || 'Unknown';
    container.querySelector('#thread-patient-id').textContent = patient.id;

    const msgContainer = container.querySelector('#thread-messages');
    if (notifs.length === 0) {
      msgContainer.innerHTML = '<div class="muted">No messages yet.</div>';
    } else {
      msgContainer.innerHTML = notifs.reverse().map(n => `
        <div class="message-bubble ${n.read_at ? 'read' : 'unread'}">
          <div class="message-meta">
            <span class="badge badge-neutral">${escapeHTML(n.channel)}</span>
            <span class="muted">${formatDate(n.sent_at)}</span>
            ${n.read_at ? `<span class="muted">· Read ${formatDate(n.read_at)}</span>` : ''}
          </div>
          <div class="message-subject">${escapeHTML(n.subject || 'Message')}</div>
          <div class="message-body">${escapeHTML(n.body || '')}</div>
        </div>
      `).join('');
    }
  } catch {
    container.querySelector('#thread-messages').innerHTML = '<div class="muted">Failed to load messages.</div>';
  }
}

function bindEvents(container) {
  const modal = container.querySelector('#comm-modal');

  container.querySelector('#new-comm-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-comm-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-comm')?.addEventListener('click', () => { modal.style.display = 'none'; });

  container.querySelector('#comm-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#comm-patient')?.value,
      type: 'general',
      channel: container.querySelector('#comm-channel')?.value,
      subject: 'New message thread',
      body: container.querySelector('#comm-body')?.value,
    };
    try {
      await apiFetch('/notifications', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Thread started', 'success');
      modal.style.display = 'none';
      container.querySelector('#comm-form').reset();
      if (payload.patient_id) openThread(container, payload.patient_id);
    } catch (err) {
      showToast(err.message || 'Failed to start thread', 'error');
    }
  });

  container.querySelector('#thread-send')?.addEventListener('click', async () => {
    const input = container.querySelector('#thread-input');
    const channel = container.querySelector('#thread-channel')?.value;
    const body = input?.value.trim();
    if (!body || !_state.currentPatientId) return;
    try {
      await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: _state.currentPatientId,
          type: 'general',
          channel,
          subject: 'Reply',
          body,
        }),
      });
      input.value = '';
      openThread(container, _state.currentPatientId);
    } catch (err) {
      showToast(err.message || 'Failed to send', 'error');
    }
  });

  container.querySelector('#comm-patient-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    container.querySelectorAll('.thread-item').forEach(item => {
      const name = item.querySelector('.thread-item-name')?.textContent.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
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
