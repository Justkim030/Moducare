/**
 * ModuCare MS — Audit & Compliance Module
 * Features: Audit log viewing, compliance task tracking
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/src/features/audit-compliance/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

let _state = { filterAction: 'all', search: '' };

export async function init(container, State) {
  injectCSS();
  container.innerHTML = await (await fetch('/src/features/audit-compliance/template.html')).text();
  bindEvents(container);
  await loadAndRender(container);
  return { destroy() {} };
}

async function loadAndRender(container) {
  try {
    const data = await apiFetch('/audit');
    if (!data.ok) throw new Error(data?.error || 'Failed');
    const audit = data.audit || [];
    renderAudit(container, audit);
  } catch (e) {
    showToast('Failed to load audit log', 'error');
  }
}

function bindEvents(container) {
  container.querySelector('#audit-search')?.addEventListener('input', (e) => {
    _state.search = e.target.value.toLowerCase();
    loadAndRender(container);
  });
  container.querySelector('#audit-filter')?.addEventListener('change', (e) => {
    _state.filterAction = e.target.value;
    loadAndRender(container);
  });
  container.querySelector('#refresh-audit')?.addEventListener('click', async () => {
    await loadAndRender(container);
    showToast('Audit log refreshed', 'success');
  });
}

function renderAudit(container, audit) {
  const filtered = audit.filter(a => {
    const matchesAction = _state.filterAction === 'all' || a.action === _state.filterAction;
    const matchesSearch = !_state.search ||
      (a.details && a.details.toLowerCase().includes(_state.search)) ||
      (a.resource_type && a.resource_type.toLowerCase().includes(_state.search));
    return matchesAction && matchesSearch;
  });

  const tbody = container.querySelector('#audit-table tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No audit entries found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td>${formatDate(a.timestamp)}</td>
      <td><span class="badge badge-neutral">${escapeHTML(a.action)}</span></td>
      <td>${escapeHTML(a.details || '—')}</td>
      <td>${escapeHTML(a.resource_type || '—')}</td>
      <td><span class="badge ${a.status === 'success' ? 'badge-success' : 'badge-danger'}">${escapeHTML(a.status)}</span></td>
    </tr>
  `).join('');
}