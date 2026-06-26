/**
 * Dashboard Feature Logic
 * Handles sub-view routing and role-based card generation.
 */
import { apiFetch, escapeHTML, formatCurrency } from '../../../js/utils.js';
import { getDashboardProfile } from '../../../js/auth.js';

export async function init(mount, State) {
  const path = window.location.pathname;
  const segments = path.split('/');
  const subView = segments[2] || 'overview';

  const profile = getDashboardProfile(State?.getUser?.()?.role);

  const title = mount.querySelector('#dashboard-title');
  const subtitle = mount.querySelector('#dashboard-subtitle');
  if (title) title.textContent = profile.title;
  if (subtitle) subtitle.textContent = profile.description;

  renderRoleCards(mount, profile.cards);
  switchView(mount, subView);
  await loadDashboardData(mount);

  return {
    destroy: () => {}
  };
}

function renderRoleCards(mount, cards) {
  const grid = mount.querySelector('#role-cards');
  if (!grid) return;
  grid.innerHTML = cards.map(card => `
    <a href="${card.route}" data-route class="role-card" title="${escapeHTML(card.title)}">
      <span class="role-card__icon">${card.icon}</span>
      <span class="role-card__title">${escapeHTML(card.title)}</span>
      <span class="role-card__metric" data-metric="${card.data}">0</span>
    </a>
  `).join('');
}

function switchView(mount, viewId) {
  mount.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
  const target = mount.querySelector(`#view-${viewId}`) || mount.querySelector('#view-overview');
  target.classList.add('active');

  const title = mount.querySelector('#dashboard-title');
  if (title && viewId !== 'overview') {
    title.textContent = `Dashboard / ${viewId.charAt(0).toUpperCase() + viewId.slice(1).replace('-', ' ')}`;
  }
}

async function loadDashboardData(mount) {
  try {
    // Fetch real dashboard metrics
    const statsResp = await fetch('/api/dashboard');
    const result = statsResp.ok ? await statsResp.json() : {};
    const stats = result.stats || {};

    // Update role card metrics with real data
    document.querySelectorAll('.role-card__metric').forEach(el => {
      const key = el.dataset.metric;
      if (stats[key] !== undefined) {
        const value = stats[key];
        el.textContent = key === 'finance' 
          ? formatCurrency(value)
          : value + (key === 'notifications' ? ' new' : key === 'documents' ? ' pending' : key.includes('Tasks') ? ' open' : '');
      }
    });

    // Load activities
    const activities = await apiFetch('/activities').catch(() => []);
    const body = mount.querySelector('#recent-body');
    if (body) {
      body.innerHTML = activities.length > 0 
        ? activities.slice(0, 5).map(a => `
            <tr>
              <td>${new Date(a.time || a.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${a.user || 'System'}</td>
              <td>${escapeHTML(a.action)}</td>
              <td><span class="mc-muted">${a.details || ''}</span></td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="mc-muted">No recent activity found.</td></tr>';
    }

    // Load appointments for calendar
    const appointments = await apiFetch('/appointments').catch(() => []);
    const calList = mount.querySelector('#calendar-list');
    if (calList) {
      calList.innerHTML = appointments.length > 0
        ? appointments.map(appt => `
            <div class="calendar-item">
              <div class="calendar-item__date">
                <span class="day">${new Date(appt.time || appt.created).getDate()}</span>
                <span class="month">${new Date(appt.time || appt.created).toLocaleDateString([], { month: 'short' })}</span>
              </div>
              <div class="calendar-item__body">
                <div class="calendar-item__title">${appt.type || appt.patient || 'Appointment'}</div>
                <div class="calendar-item__meta">${appt.time || ''}</div>
              </div>
            </div>`).join('')
        : '<p class="mc-muted">No upcoming appointments found.</p>';
    }

  } catch (err) {
    console.error('Dashboard: Data load failed', err);
  }
}