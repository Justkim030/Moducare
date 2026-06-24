/**
 * ModuCare MS — Analytics & Reports Module
 * Status : 🔲 Scaffolded — ready for implementation
 * Path   : /src/features/analytics-reports/index.js
 * CSS    : /src/features/analytics-reports/styles.css
 */
import { showToast } from '../../../js/utils.js';

export function render(container) {
  container.innerHTML = buildShell();
  container.querySelector('#primary-action-btn')
    ?.addEventListener('click', () =>
      showToast('Analytics & Reports — implementation coming soon.', 'info')
    );
}

const ALLOWED_ROLES = ['admin','analyst'];

export async function init(mount, State){
  const user = State.getUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)){
    mount.innerHTML = `<section aria-labelledby="forbidden-analytics"><h2 id="forbidden-analytics">403 — Forbidden</h2><p>Analytics access requires analyst or admin role.</p></section>`;
    return { destroy(){} };
  }
  // backward-compatible init wrapper for router
  render(mount);
  return { destroy(){ /* add teardown if needed */ } };
}

function buildShell() {
  return `
  <div class="section-header">
    <div>
      <div class="section-title">Analytics & Reports</div>
      <div class="section-subtitle">Cross-departmental reporting, payroll breakdowns, compliance summaries, and roster exports.</div>
    </div>
    <button class="btn btn-primary" id="primary-action-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5"  y1="12" x2="19" y2="12"/>
      </svg>
      New Analytics & Reports
    </button>
  </div>

  <div class="scaffold-wrapper">

    <div class="scaffold-hero">
      <div class="scaffold-icon"
           style="background:#EEF5FB;border-color:#1E579940">📊</div>
      <div class="scaffold-title">Analytics & Reports</div>
      <div class="scaffold-desc">Cross-departmental reporting, payroll breakdowns, compliance summaries, and roster exports.</div>
    </div>

    <div class="scaffold-sections">

      <div class="card scaffold-section">
        <div class="scaffold-section__label">📌 Summary Stats</div>
        <div class="scaffold-section__hint">
          KPI cards — totals, status counts, date-based alerts.
        </div>
        <div class="skeleton-row">
          ${Array(4).fill(
            '<div class="skeleton" style="height:90px;border-radius:10px"></div>'
          ).join('')}
        </div>
      </div>

      <div class="card scaffold-section">
        <div class="scaffold-section__label">🗂 Main Data View</div>
        <div class="scaffold-section__hint">
          Primary table, grid, board, or calendar for this module.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${Array(5).fill(`
            <div style="display:flex;gap:12px;align-items:center">
              <div class="skeleton"
                   style="width:36px;height:36px;border-radius:50%;flex-shrink:0"></div>
              <div class="skeleton" style="height:15px;flex:1;border-radius:4px"></div>
              <div class="skeleton" style="height:15px;width:90px;border-radius:4px"></div>
              <div class="skeleton" style="height:15px;width:60px;border-radius:4px"></div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card scaffold-section">
        <div class="scaffold-section__label">⚙️ Actions &amp; Forms</div>
        <div class="scaffold-section__hint">
          Modals, drawers, or inline forms for create / edit / delete operations.
        </div>
        <div class="flex gap-3">
          <div class="skeleton" style="height:36px;width:140px;border-radius:6px"></div>
          <div class="skeleton" style="height:36px;width:140px;border-radius:6px"></div>
          <div class="skeleton" style="height:36px;width:100px;border-radius:6px"></div>
        </div>
      </div>

    </div>

    <div class="scaffold-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      Assign to <code>/src/features/analytics-reports/</code>
    </div>

  </div>`;
}
