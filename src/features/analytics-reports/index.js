/**
 * ModuCare MS — Analytics & Reports Module
 * Features: KPI overview, real data aggregation, trend tracking
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/analytics-reports/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshOverview(container);
  refreshTrends(container);
}

export async function init(container, State) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

function buildShell() {
  return `
  <div class="analytics-layout">
    <div class="analytics-header">
      <h1>📊 Analytics & Reports</h1>
      <div class="analytics-actions">
        <button class="mc-btn btn-ghost btn-sm" id="refresh-analytics-btn">🔄 Refresh</button>
        <button class="mc-btn btn-primary btn-sm" id="export-analytics-btn">📥 Export CSV</button>
      </div>
    </div>

    <div class="kpi-grid" id="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total Patients</div><div class="kpi-value" id="kpi-patients">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Active (HIV+)</div><div class="kpi-value" id="kpi-active">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Encounters</div><div class="kpi-value" id="kpi-encounters">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Lab Orders</div><div class="kpi-value" id="kpi-labs">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Pending Labs</div><div class="kpi-value" id="kpi-pending-labs">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Dispensings</div><div class="kpi-value" id="kpi-dispensing">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Appointments</div><div class="kpi-value" id="kpi-appointments">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Scheduled</div><div class="kpi-value" id="kpi-scheduled">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Notifications</div><div class="kpi-value" id="kpi-notifications">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Unread</div><div class="kpi-value" id="kpi-unread">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Inventory Items</div><div class="kpi-value" id="kpi-inventory">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Low Stock</div><div class="kpi-value" id="kpi-lowstock">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Referrals</div><div class="kpi-value" id="kpi-referrals">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Pending Referrals</div><div class="kpi-value" id="kpi-pending-referrals">—</div></div>
    </div>

    <div class="analytics-section">
      <h2>Recent Activity</h2>
      <div id="recent-activity" class="recent-activity-list"></div>
    </div>

    <div class="analytics-section">
      <h2>Inventory Status</h2>
      <div id="inventory-status" class="inventory-grid"></div>
    </div>
  </div>`;
}

async function refreshOverview(container) {
  try {
    const data = await apiFetch('/analytics/overview');
    if (!data.ok) throw new Error(data?.error || 'Failed');
    const s = data.stats;
    setKpi('kpi-patients', s.totalPatients);
    setKpi('kpi-active', s.activePatients);
    setKpi('kpi-encounters', s.totalEncounters);
    setKpi('kpi-labs', s.totalLabOrders);
    setKpi('kpi-pending-labs', s.pendingLabOrders);
    setKpi('kpi-dispensing', s.totalDispensing);
    setKpi('kpi-appointments', s.totalAppointments);
    setKpi('kpi-scheduled', s.scheduledAppointments);
    setKpi('kpi-notifications', s.totalNotifications);
    setKpi('kpi-unread', s.unreadNotifications);
    setKpi('kpi-inventory', s.totalInventory);
    setKpi('kpi-lowstock', s.lowStockItems);
    setKpi('kpi-referrals', s.totalReferrals);
    setKpi('kpi-pending-referrals', s.pendingReferrals);
  } catch (e) {
    showToast('Failed to load analytics overview', 'error');
  }
}

function setKpi(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '0';
}

async function refreshTrends(container) {
  try {
    const [patientsRes, apptsRes, inventoryRes] = await Promise.all([
      apiFetch('/patients'),
      apiFetch('/appointments'),
      apiFetch('/inventory'),
    ]);

    const patients = patientsRes.patients || [];
    const appts = apptsRes.appointments || [];
    const inventory = inventoryRes.inventory || [];

    const activity = container.querySelector('#recent-activity');
    if (activity) {
      const recent = appts.slice(0, 10);
      if (recent.length === 0) {
        activity.innerHTML = '<div class="muted">No recent activity.</div>';
      } else {
        activity.innerHTML = recent.map(a => `
          <div class="activity-item">
            <div class="activity-icon">📅</div>
            <div class="activity-content">
              <div class="activity-title">${escapeHTML(a.patient_name || 'Unknown')} — ${escapeHTML(a.type || 'Appointment')}</div>
              <div class="activity-meta">${formatDate(a.time)} · ${escapeHTML(a.provider_name || 'Unassigned')}</div>
            </div>
            <span class="badge badge-neutral">${escapeHTML(a.status || 'N/A')}</span>
          </div>
        `).join('');
      }
    }

    const invGrid = container.querySelector('#inventory-status');
    if (invGrid) {
      const lowStock = inventory.filter(i => i.current_stock <= i.reorder_level);
      if (lowStock.length === 0) {
        invGrid.innerHTML = '<div class="muted">All inventory items are above reorder levels.</div>';
      } else {
        invGrid.innerHTML = lowStock.map(i => `
          <div class="inventory-card ${i.current_stock <= 0 ? 'stock-out' : 'low-stock'}">
            <div class="inventory-name">${escapeHTML(i.name)}</div>
            <div class="inventory-meta">${escapeHTML(i.category)} · ${i.current_stock} / ${i.reorder_level} ${escapeHTML(i.unit)}</div>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Trends error:', e);
  }
}

function bindEvents(container) {
  container.querySelector('#refresh-analytics-btn')?.addEventListener('click', () => {
    refreshOverview(container);
    refreshTrends(container);
    showToast('Analytics refreshed', 'success');
  });

  container.querySelector('#export-analytics-btn')?.addEventListener('click', () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Patients', document.getElementById('kpi-patients')?.textContent || ''],
      ['Active Patients', document.getElementById('kpi-active')?.textContent || ''],
      ['Encounters', document.getElementById('kpi-encounters')?.textContent || ''],
      ['Lab Orders', document.getElementById('kpi-labs')?.textContent || ''],
      ['Pending Labs', document.getElementById('kpi-pending-labs')?.textContent || ''],
      ['Dispensings', document.getElementById('kpi-dispensing')?.textContent || ''],
      ['Appointments', document.getElementById('kpi-appointments')?.textContent || ''],
      ['Scheduled', document.getElementById('kpi-scheduled')?.textContent || ''],
      ['Notifications', document.getElementById('kpi-notifications')?.textContent || ''],
      ['Unread', document.getElementById('kpi-unread')?.textContent || ''],
      ['Inventory Items', document.getElementById('kpi-inventory')?.textContent || ''],
      ['Low Stock', document.getElementById('kpi-lowstock')?.textContent || ''],
      ['Referrals', document.getElementById('kpi-referrals')?.textContent || ''],
      ['Pending Referrals', document.getElementById('kpi-pending-referrals')?.textContent || ''],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'analytics_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  });
}
