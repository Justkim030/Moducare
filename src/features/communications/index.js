/**
 * ModuCare MS — Communications Module
 * Features: Secure messaging threads, referral coordination, notifications log, CRUD
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/src/features/communications/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

let _state = { currentPatientId: null, messages: [], tab: 'threads' };
let _notifications = [];
let _notifFilter = { type: 'all', channel: 'all', search: '' };
let _notifPage = 1;
let _notifPerPage = 10;
window.__NOTIF_PAGINATION = { page: 1, totalPages: 1, total: 0 };

const NOTIF_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'general', label: 'General' },
  { value: 'referral', label: 'Referral' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'alert', label: 'Alert' },
];
const CHANNELS = [
  { value: 'all', label: 'All Channels' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'in-app', label: 'In-App' },
];

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  switchCommTab(container, _state.tab);
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
      <div>
        <h1>💬 Communications</h1>
        <p style="color: var(--text-tertiary); font-size: 13px; margin-top: 4px;">Internal messaging, announcements, and department-wide notifications.</p>
      </div>
      <button class="mc-btn btn-primary" id="new-comm-btn">+ New Thread</button>
    </div>

    <div class="comm-tabs">
      <button class="comm-tab-trigger ${_state.tab==='threads'?'active':''}" data-tab="threads">Message Threads</button>
      <button class="comm-tab-trigger ${_state.tab==='log'?'active':''}" data-tab="log">Notifications Log</button>
    </div>

    <div id="comm-tab-content" style="flex:1; overflow:hidden; display:flex; flex-direction:column;"></div>

  <div id="comm-modal" class="modal-overlay hidden">
        <div class="modal-card modal-card--md">
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

function switchCommTab(container, tab) {
  _state.tab = tab;
  container.querySelectorAll('.comm-tab-trigger').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  const content = container.querySelector('#comm-tab-content');
  if (!content) return;
  if (tab === 'threads') renderThreads(content, container);
  else renderLog(content, container);
}

function renderThreads(content, container) {
  content.style.display = 'flex';
  content.innerHTML = `
    <div class="comm-split" style="flex:1; overflow:hidden;">
      <div class="comm-sidebar" style="height:100%; overflow:hidden; display:flex; flex-direction:column;">
        <div class="comm-sidebar-header">
          <input type="search" id="comm-patient-search" class="input" placeholder="Search patient..." />
        </div>
        <div id="thread-list" class="thread-list" style="flex:1; overflow-y:auto;"></div>
      </div>
      <div class="thread-view" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
        <div id="thread-empty" class="empty-state" style="flex:1;">
          <h3>Select a conversation</h3>
          <p>Choose a patient from the left to view messages, or start a new thread.</p>
        </div>
        <div id="thread-content" class="hidden" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
          <div class="thread-header">
            <h3 id="thread-patient-name">Patient</h3>
            <span class="badge badge-neutral" id="thread-patient-id"></span>
          </div>
          <div id="thread-messages" class="thread-messages" style="flex:1; overflow-y:auto;"></div>
          <div class="thread-composer">
            <textarea id="thread-input" class="input" rows="2" placeholder="Type a message..."></textarea>
            <div class="thread-composer-actions">
              <select id="thread-channel" class="input w-auto">
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
    </div>`;

  container.querySelector('#comm-patient-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    container.querySelectorAll('.thread-item').forEach(item => {
      const name = item.querySelector('.thread-item-name').textContent.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
  });

  refreshThreadList(container);

  container.querySelector('#thread-send').addEventListener('click', async () => {
    const input = container.querySelector('#thread-input');
    const channel = container.querySelector('#thread-channel').value;
    const body = input.value.trim();
    if (!body || !_state.currentPatientId) return;
    try {
      const data = await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: _state.currentPatientId,
          type: 'general',
          channel,
          subject: 'Reply',
          body,
        }),
      });
      if (!data.ok) throw new Error(data.error || 'Failed');
      input.value = '';
      openThread(container, _state.currentPatientId);
      showToast('Message sent', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to send', 'error');
    }
  });
}

function renderLog(content, container) {
  const filtered = getFilteredNotifications();
  const total = filtered.length;
  const start = (_notifPage - 1) * _notifPerPage;
  const slice = filtered.slice(start, start + _notifPerPage);
  const pages = Math.max(1, Math.ceil(total / _notifPerPage));

  content.innerHTML = `
  <div style="display:flex; flex-direction:column; gap:16px; height:100%; overflow:hidden;">
    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
      <label style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">Filter by Type:</label>
      <select id="notif-type-filter" class="input filter-select" style="padding: 6px 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
        ${NOTIF_TYPES.map(o=>`<option value="${o.value}" ${_notifFilter.type===o.value?'selected':''}>${o.label}</option>`).join('')}
      </select>
      <label style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">Filter by Channel:</label>
      <select id="notif-channel-filter" class="input filter-select" style="padding: 6px 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
        ${CHANNELS.map(o=>`<option value="${o.value}" ${_notifFilter.channel===o.value?'selected':''}>${o.label}</option>`).join('')}
      </select>
      <input type="search" id="notif-search" class="input" placeholder="Search subject or patient..." value="${escapeHTML(_notifFilter.search)}" style="padding: 6px 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; width: 260px;" />
      <div style="margin-left: auto; font-size: 12px; color: var(--text-tertiary);">Showing ${total ? start + 1 : 0}-${Math.min(start + _notifPerPage, total)} of ${total}</div>
    </div>
    <div style="flex:1; overflow:auto; border: 1px solid var(--border-light); border-radius: 8px; background: var(--surface-card);">
      <table class="mc-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Channel</th>
            <th>Subject</th>
            <th>Patient</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${slice.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-tertiary);padding:24px;">No notifications found</td></tr>` : slice.map(n => `
            <tr>
              <td class="text-secondary text-sm">${formatDate(n.sent_at || n.created_at)}</td>
              <td><span class="badge badge-neutral">${escapeHTML(n.type || 'general')}</span></td>
              <td class="text-secondary">${escapeHTML(n.channel)}</td>
              <td style="font-weight:500; color: var(--text-primary);">${escapeHTML(n.subject || 'Message')}</td>
              <td class="text-secondary">${escapeHTML(n.patient_name || '—')}</td>
              <td>
                <div class="flex gap-1 justify-center">
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="edit" data-id="${n.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="delete" data-id="${n.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${pages > 1 ? buildNotifPagination(pages, total) : ''}
  </div>`;

  const typeFilter = content.querySelector('#notif-type-filter');
  if (typeFilter) typeFilter.addEventListener('change', e => { _notifFilter.type = e.target.value; _notifPage = 1; renderLog(content, container); });
  const channelFilter = content.querySelector('#notif-channel-filter');
  if (channelFilter) channelFilter.addEventListener('change', e => { _notifFilter.channel = e.target.value; _notifPage = 1; renderLog(content, container); });
  const searchInput = content.querySelector('#notif-search');
  if (searchInput) searchInput.addEventListener('input', e => { _notifFilter.search = e.target.value; _notifPage = 1; renderLog(content, container); });

  content.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => editNotification(container, btn.dataset.id));
  });
  content.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteNotification(container, btn.dataset.id));
  });

  const pagEl = content.querySelector('#comm-pagination');
  if (pagEl) {
    pagEl.addEventListener('click', e => {
      const b = e.target.closest('[data-page]');
      if (!b || b.disabled) return;
      const p = b.dataset.page;
      if (p === 'prev') _notifPage = Math.max(1, _notifPage - 1);
      else if (p === 'next') _notifPage = Math.min(pages, _notifPage + 1);
      else _notifPage = parseInt(p, 10);
      renderLog(content, container);
    });
  }
}

function buildNotifPagination(pages, total) {
  const start = (_notifPage - 1) * _notifPerPage + 1;
  const end   = Math.min(_notifPage * _notifPerPage, total);
  let btns = `<button class="page-btn" ${_notifPage===1?'disabled':''} data-page="prev">←</button>`;
  for (let i=1;i<=pages;i++) {
    btns += `<button class="page-btn ${i===_notifPage?'active':''}" data-page="${i}">${i}</button>`;
  }
  btns += `<button class="page-btn" ${_notifPage===pages?'disabled':''} data-page="next">→</button>`;
  return `<div id="comm-pagination" class="pagination"><span class="pagination-info">Showing ${start}-${end} of ${total}</span>${btns}</div>`;
}

function getFilteredNotifications() {
  return _notifications.filter(n => {
    const q = _notifFilter.search.toLowerCase();
    const matchQ = !q || (n.subject || '').toLowerCase().includes(q) || (n.patient_name || '').toLowerCase().includes(q);
    const matchType = _notifFilter.type === 'all' || n.type === _notifFilter.type;
    const matchChannel = _notifFilter.channel === 'all' || n.channel === _notifFilter.channel;
    return matchQ && matchType && matchChannel;
  });
}

function editNotification(container, id) {
  const item = _notifications.find(n => String(n.id) === String(id));
  if (!item) return;
  const newSubject = prompt('Edit subject:', item.subject);
  if (newSubject === null) return;
  apiFetch('/notifications/' + id, { method: 'PUT', body: JSON.stringify({ subject: newSubject }) }).then(data => {
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Notification updated.', 'success');
    return loadNotifications();
  }).then(() => {
    renderLog(container.querySelector('#comm-tab-content'), container);
  }).catch(e => {
    showToast(e.message || 'Failed to update notification', 'error');
  });
}

function deleteNotification(container, id) {
  if (!confirm('Delete this notification?')) return;
  apiFetch('/notifications/' + id, { method: 'DELETE' }).then(data => {
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Notification deleted.', 'success');
    return loadNotifications();
  }).then(() => {
    renderLog(container.querySelector('#comm-tab-content'), container);
  }).catch(e => {
    showToast(e.message || 'Failed to delete notification', 'error');
  });
}

async function refreshThreadList(container) {
  const list = container.querySelector('#thread-list');
  if (!list) return;
  try {
    const data = await apiFetch('/patients');
    const patients = data.data || data.patients || [];
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
    const data = await apiFetch('/notifications?patient_id=' + encodeURIComponent(patientId));
    const notifs = data.data || data.notifications || [];
    const patientData = await apiFetch('/patients/' + patientId);
    const patient = patientData.data || patientData.patient || {};
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

async function loadNotifications() {
  try {
    const data = await apiFetch('/notifications');
    if (!data.ok) throw new Error(data.error || 'Failed');
    const list = data.data || [];
    // Enrich with patient names
    _notifications = list.map(n => ({
      ...n,
      patient_name: n.patient_name || n.patient?.name || '—',
    }));
    window.__NOTIF_PAGINATION = data.pagination || { page: 1, limit: 10, total: list.length, totalPages: 1 };
  } catch (e) {
    showToast('Failed to load notifications', 'error');
  }
}

async function populatePatients(container) {
  const select = container.querySelector('#comm-patient');
  if (!select) return;
  try {
    const data = await apiFetch('/patients');
    const patients = data.data || data.patients || [];
    select.innerHTML = '<option value="">-- Select Patient --</option>' +
      patients.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.email || 'no email')})</option>`).join('');
  } catch {
    showToast('Failed to load patients', 'error');
  }
}

function bindEvents(container) {
  const modal = container.querySelector('#comm-modal');

  container.querySelector('#new-comm-btn').addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });
  container.querySelector('#close-comm-modal').addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-comm').addEventListener('click', () => { modal.style.display = 'none'; });

  container.querySelector('#comm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#comm-patient').value,
      type: 'general',
      channel: container.querySelector('#comm-channel').value,
      subject: 'New message thread',
      body: container.querySelector('#comm-body').value,
    };
    try {
      const data = await apiFetch('/notifications', { method: 'POST', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Thread started', 'success');
      modal.style.display = 'none';
      container.querySelector('#comm-form').reset();
      if (payload.patient_id) openThread(container, payload.patient_id);
    } catch (err) {
      showToast(err.message || 'Failed to start thread', 'error');
    }
  });

  container.querySelectorAll('.comm-tab-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'log') loadNotifications();
      switchCommTab(container, btn.dataset.tab);
    });
  });
}
