/**
 * ModuCare MS — Communications Module
 * Modular application component rendering active threads and contextual feeds.
 */
import { showToast } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; 
  l.href = 'features/communications/comm.css';
  document.head.appendChild(l); 
  _cssLoaded = true;
}

// Thread Database Mock Cache
const THREADS = [
  { id: 't1', sender: 'Dr. Robert Chen', initials: 'DR', subject: 'Patient Discharge Coordination Protocol', dept: 'Radiology Dept', tag: 'MANDATORY ACTION', tagClass: 'comm-tag--mandatory', time: '10:42 AM', body: "Please initiate the discharge protocol for 2:00 PM today. Ensure she has her follow-up appointment scheduled with Cardiology for next Tuesday. I've already signed the prescription orders in the system." },
  { id: 't2', sender: 'Nurse Clara Vance', initials: 'CV', subject: 'ICU Shift Handover Log Updates', dept: 'Critical Care Unit', tag: 'FACILITY UPDATE', tagClass: 'comm-tag--facility', time: '09:15 AM', body: "Bed 4 and Bed 7 stabilized post-op. Detailed telemetry trends metrics and medical charts have been saved into the central system portal directory." },
  { id: 't3', sender: 'Admin Sarah Jenkins', initials: 'SJ', subject: 'Q3 Compliance Audit Review Schedule', dept: 'Administration', tag: 'SYSTEM RUNTIME', tagClass: 'comm-tag--system', time: 'Yesterday', body: "The annual corporate quality framework baseline evaluation takes place next Tuesday morning. Please ensure your operational logs are fully compiled." }
];

let _activeThreadId = 't1';

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  renderThreads(container);
  renderActiveMessage(container);
  bindEvents(container);
}

function buildShell() {
  return `
  <section class="feature-communications">
    
    <div class="comm-header">
      <div>
        <h2 class="comm-title">Communications Hub</h2>
        <p class="comm-subtitle">Internal messaging, announcements, and department-wide notifications across the organization.</p>
      </div>
      <button class="mc-btn icon-btn" id="comm-new-msg-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Message
      </button>
    </div>

    <div class="comm-workspace-grid">
      
      <div class="comm-sidebar-panel">
        <div class="comm-panel-title">Active Correspondence</div>
        <div class="comm-threads-list" id="comm-threads-target"></div>
      </div>

      <div class="comm-chat-panel" id="comm-chat-viewport"></div>

    </div>
  </section>`;
}

function renderThreads(container) {
  const target = container.querySelector('#comm-threads-target');
  if (!target) return;

  target.innerHTML = THREADS.map(t => {
    const isActive = t.id === _activeThreadId ? 'active' : '';
    return `
    <div class="comm-thread-item ${isActive}" data-id="${t.id}">
      <div class="comm-thread-top">
        <span class="comm-thread-sender">${t.sender}</span>
        <span class="comm-thread-time">${t.time}</span>
      </div>
      <div class="comm-thread-subject">${t.subject}</div>
      <div class="comm-thread-dept">
        <span>${t.dept}</span>
        <span class="comm-tag ${t.tagClass}">${t.tag}</span>
      </div>
    </div>`;
  }).join('');

  // Rebind tracking list listeners
  target.querySelectorAll('.comm-thread-item').forEach(item => {
    item.onclick = (e) => {
      _activeThreadId = e.currentTarget.dataset.id;
      container.querySelectorAll('.comm-thread-item').forEach(i => i.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderActiveMessage(container);
    };
  });
}

function renderActiveMessage(container) {
  const viewport = container.querySelector('#comm-chat-panel');
  const thread = THREADS.find(t => t.id === _activeThreadId) || THREADS[0];
  if (!viewport) return;

  viewport.innerHTML = `
    <div class="comm-chat-header">
      <div class="comm-avatar">${thread.initials}</div>
      <div class="comm-chat-meta">
        <h4>${thread.subject}</h4>
        <p>Originator: ${thread.sender} &bull; ${thread.dept}</p>
      </div>
      <span class="comm-tag ${thread.tagClass}">${thread.tag}</span>
    </div>

    <div class="comm-chat-feed" id="comm-feed-scroll">
      <div class="comm-bubble-wrapper">
        <div class="comm-msg-bubble">
          <p class="comm-msg-text">${thread.body}</p>
          <div class="comm-msg-footer">Sent at ${thread.time} &bull; Certified Secure Entry</div>
        </div>
      </div>
    </div>

    <div class="comm-reply-dock">
      <div class="comm-input-wrapper">
        <input type="text" id="comm-reply-input" placeholder="Type a secure system reply notice statement..." />
        <button class="comm-btn-send" id="comm-send-msg-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19l7-7-7-7M5 12h14"/></svg>
        </button>
      </div>
    </div>`;

  // Bind local delivery engines inside the newly drawn view ports
  bindReplyActions(viewport);
}

function bindReplyActions(viewport) {
  const sendBtn = viewport.querySelector('#comm-send-msg-btn');
  const inputField = viewport.querySelector('#comm-reply-input');
  const scrollFeed = viewport.querySelector('#comm-feed-scroll');

  const executeSend = () => {
    const val = inputField?.value.trim();
    if (!val) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'comm-bubble-wrapper outgoing';
    wrapper.innerHTML = `
      <div class="comm-msg-bubble outgoing">
        <p class="comm-msg-text">${val}</p>
        <div class="comm-msg-footer">Just Now &bull; Self Account</div>
      </div>`;

    scrollFeed?.appendChild(wrapper);
    inputField.value = '';
    if (scrollFeed) scrollFeed.scrollTop = scrollFeed.scrollHeight;
    showToast('Secure correspondence node successfully dispatched.', 'success');
  };

  sendBtn?.addEventListener('click', executeSend);
  inputField?.addEventListener('keydown', (e) => { if (e.key === 'Enter') executeSend(); });
}

function bindEvents(container) {
  container.querySelector('#comm-new-msg-btn')?.addEventListener('click', () => {
    showToast('Message composer drawer overlay state active.', 'info');
  });
}