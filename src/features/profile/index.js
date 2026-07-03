/**
 * ModuCare MS — Profile Module
 */
import { escapeHTML } from '../../../js/utils.js';
import { getSession, getUserRoleLabel } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/profile/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  populateProfile(container);
}

export async function init(container, State) {
  render(container);
  return { destroy() {} };
}

function buildShell() {
  return `
  <div class="profile-layout">
    <h2>👤 Profile</h2>
    <div class="profile-card">
      <div class="profile-avatar" id="profile-avatar">U</div>
      <div class="profile-info">
        <div class="profile-name" id="profile-name">—</div>
        <div class="profile-email" id="profile-email">—</div>
        <div class="profile-role"><span class="badge" id="profile-role">User</span></div>
      </div>
    </div>
    <div class="profile-details">
      <div class="profile-field"><span class="profile-label">Employee ID</span><span id="profile-employee">—</span></div>
      <div class="profile-field"><span class="profile-label">User ID</span><span id="profile-userid">—</span></div>
      <div class="profile-field"><span class="profile-label">Department</span><span id="profile-dept">—</span></div>
      <div class="profile-field"><span class="profile-label">Phone</span><span id="profile-phone">—</span></div>
    </div>
  </div>`;
}

function populateProfile(container) {
  const session = getSession();
  const name = session?.name || '—';
  const initials = (session?.name || 'U').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();

  container.querySelector('#profile-avatar').textContent = escapeHTML(initials);
  container.querySelector('#profile-name').textContent = escapeHTML(name);
  container.querySelector('#profile-email').textContent = escapeHTML(session?.email || '—');
  container.querySelector('#profile-role').textContent = escapeHTML(getUserRoleLabel() || 'User');
  container.querySelector('#profile-employee').textContent = escapeHTML(session?.employee_id || '—');
  container.querySelector('#profile-userid').textContent = escapeHTML(session?.id || '—');
  container.querySelector('#profile-dept').textContent = escapeHTML(session?.department_name || '—');
  container.querySelector('#profile-phone').textContent = escapeHTML(session?.phone_number || '—');
}
