/**
 * Dashboard Feature Logic
 * Handles sub-view routing within the dashboard module.
 */
import { apiFetch } from '../../../js/utils.js';

export async function init(mount, State) {
  const path = window.location.pathname;
  const segments = path.split('/');
  const subView = segments[2] || 'overview'; // Fallback to overview if path is just /dashboard

  switchView(mount, subView);
  loadDashboardData(mount);

  return {
    destroy: () => {}
  };
}

function switchView(mount, viewId) {
  // Hide all views and show target
  mount.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
  const target = mount.querySelector(`#view-${viewId}`) || mount.querySelector('#view-overview');
  target.classList.add('active');

  // Update Breadcrumb/Title
  const title = mount.querySelector('#dashboard-title');
  if (title) title.textContent = `Dashboard / ${viewId.charAt(0).toUpperCase() + viewId.slice(1).replace('-', ' ')}`;
}

async function loadDashboardData(mount) {
  try {
    // 1. Load Recent Activity for Overview
    const activities = await apiFetch('/activities').catch(() => []);
    const body = mount.querySelector('#recent-body');
    if (body) {
      body.innerHTML = activities.length > 0 
        ? activities.slice(0, 5).map(a => `
            <tr>
              <td>${new Date(a.time || a.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${a.user || 'System'}</td>
              <td>${a.action}</td>
              <td><span class="mc-muted">${a.details || ''}</span></td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="mc-muted">No recent activity found.</td></tr>';
    }

    // 2. Load Appointments for Calendar
    const appointments = await apiFetch('/appointments').catch(() => []);
    const calList = mount.querySelector('#calendar-list');
    if (calList) {
      calList.innerHTML = appointments.length > 0
        ? appointments.map(appt => `
            <div class="calendar-item">
              <div class="calendar-item__date">
                <span class="day">${new Date(appt.date || appt.created).getDate()}</span>
                <span class="month">${new Date(appt.date || appt.created).toLocaleDateString([], { month: 'short' })}</span>
              </div>
              <div class="calendar-item__body">
                <div class="calendar-item__title">${appt.title || appt.patient || 'Appointment'}</div>
                <div class="calendar-item__meta">${appt.time || ''} ${appt.location ? '· ' + appt.location : ''}</div>
              </div>
            </div>`).join('')
        : '<p class="mc-muted">No upcoming appointments found.</p>';
    }

    // 3. Reset/Populate KPI metrics
    // Financial Metrics (Renamed to KPI 1) - Currency updated to KSh
    if (mount.querySelector('#kpi-revenue')) mount.querySelector('#kpi-revenue').textContent = 'KSh 0.00';
    if (mount.querySelector('#kpi-costs')) mount.querySelector('#kpi-costs').textContent = 'KSh 0.00';

  } catch (err) {
    console.error('Dashboard: Data load failed', err);
  }
}