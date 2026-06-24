/**
 * ModuCare MS — Audit & Compliance Module
 * Features: PHI access logging, compliance reports
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/audit/styles.css';
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
  <div class="audit-layout">
    <div class="audit-header">
      <h1>🛡️ Audit & Compliance</h1>
    </div>
    <div class="audit-filters">
      <select id="audit-filter-action" class="input" style="width:auto;">
        <option value="">All Actions</option>
        <option value="login">Login</option>
        <option value="view_patient">View Patient</option>
        <option value="edit_patient">Edit Patient</option>
        <option value="create_encounter">Create Encounter</option>
        <option value="view_lab">View Lab</option>
        <option value="dispense">Dispense</option>
      </select>
    </div>
    <div id="audit-list"></div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#audit-list');
  if (!list) return;
  try {
    const data = await apiFetch('/audit');
    const logs = data.audit || [];
    if (logs.length === 0) {
      list.innerHTML = `<div class="empty-state"><h3>No audit logs</h3><p>Audit events will appear here.</p></div>`;
      return;
    }
    list.innerHTML = `
      <div class="audit-table-wrap">
        <table class="mc-table audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td>${formatDate(l.timestamp || l.time || '')}</td>
                <td>${escapeHTML(l.user || l.user_id || 'Unknown')}</td>
                <td><span class="badge badge-neutral">${escapeHTML(l.action || 'N/A')}</span></td>
                <td>${escapeHTML(l.details || '—')}</td>
                <td>${l.status ? `<span class="badge badge-success">${escapeHTML(l.status)}</span>` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><h3>Audit endpoint unavailable</h3><p>Audit logging will be available once the endpoint is connected.</p></div>`;
  }
}

function bindEvents(container) {
  container.querySelector('#audit-filter-action')?.addEventListener('change', () => refreshList(container));
}
