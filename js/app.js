/**
 * ModuCare MS — App Bootstrap
 * Entry point for the dashboard shell.
 * Runs auth checks, populates user info, wires up UI interactions.
 */
import { requireAuth, logout, getUserRoleLabel, getSession, getQuickActions, canAccessCapability, canAccessModule } from './auth.js';
import { set } from './store.js';
import { showToast, escapeHTML, apiFetch, renderQuickActions } from './utils.js';
import { getUserClass, isFeatureAllowed } from './access-classes.js';

// ── Auth Guard ───────────────────────────────────────────────
const session = requireAuth();
if (!session) throw new Error('Unauthenticated'); // redirect already triggered

// ── Store Init ───────────────────────────────────────────────
set('user', session);

// ── Populate User Info ───────────────────────────────────────
function populateUser() {
  const name     = session.name ?? 'User';
  const initials = session.initials ?? name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  const role     = getUserRoleLabel();

  // Sidebar
  const sName = document.getElementById('sidebar-user-name');
  const sRole = document.getElementById('sidebar-user-role');
  const sAvtr = document.getElementById('sidebar-user-avatar');
  if (sName) sName.textContent = name;
  if (sRole) sRole.textContent = role;
  if (sAvtr) sAvtr.textContent = initials;

  // Header
  const hName = document.getElementById('header-user-name');
  const hRole = document.getElementById('header-user-role');
  const hAvtr = document.getElementById('header-user-avatar');
  if (hName) hName.textContent = name.split(' ')[0];
  if (hRole) hRole.textContent = role;
  if (hAvtr) hAvtr.textContent = initials;
}

// ── Sidebar Collapse ─────────────────────────────────────────
function initSidebarToggle() {
  const shell   = document.getElementById('app-shell');
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');
  const icon    = document.getElementById('toggle-icon');

  if (!shell || !sidebar || !toggle) return;

  // Restore from storage
  const saved = localStorage.getItem('sidebar_collapsed');
  if (saved === 'true') {
    shell.classList.add('sidebar-collapsed');
    sidebar.classList.add('collapsed');
  }

  toggle.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    shell.classList.toggle('sidebar-collapsed', isCollapsed);
    localStorage.setItem('sidebar_collapsed', isCollapsed);

    // Flip arrow direction
    if (icon) {
      icon.innerHTML = isCollapsed
        ? '<path d="M9 18l6-6-6-6"/>'
        : '<path d="M15 18l-6-6 6-6"/>';
    }
  });
}

// ── Mobile Sidebar ───────────────────────────────────────────
function initMobileSidebar() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar   = document.getElementById('sidebar');
  if (!mobileBtn || !sidebar) return;

  // Show mobile button on small screens
  if (window.innerWidth <= 768) mobileBtn.style.display = 'flex';
  window.addEventListener('resize', () => {
    mobileBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
  });

  mobileBtn.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !mobileBtn.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });
}

// ── Global Search ────────────────────────────────────────────
function initSearch() {
  const globalSearch = document.getElementById('global-search');
  const sidebarSearch = document.getElementById('sidebar-search-trigger');

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      globalSearch?.focus();
    }
  });

  sidebarSearch?.addEventListener('click', () => globalSearch?.focus());
  sidebarSearch?.addEventListener('keydown', e => {
    if (e.key === 'Enter') globalSearch?.focus();
  });

  globalSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') globalSearch.blur();
  });

  let debounce;
  globalSearch?.addEventListener('input', (e) => {
    clearTimeout(debounce);
    const q = e.target.value.trim();
    if (q.length < 2) {
      removeSearchResults();
      return;
    }
    debounce = setTimeout(() => performSearch(q), 300);
  });
}

async function performSearch(query) {
  try {
    const data = await apiFetch(`/search?q=${encodeURIComponent(query)}&type=all`);
    if (!data.ok) return;
    showSearchResults(data);
  } catch (e) {
    console.error('Search error:', e);
  }
}

function showSearchResults(data) {
  removeSearchResults();
  if (!data.patients?.length && !data.encounters?.length && !data.labOrders?.length) {
    return;
  }
  const dropdown = document.createElement('div');
  dropdown.className = 'search-dropdown';
  dropdown.id = 'search-dropdown';
  let html = '<div class="search-dropdown-inner">';

  if (data.patients?.length) {
    html += '<div class="search-group"><div class="search-group-label">Patients</div>';
    data.patients.forEach(p => {
      html += `<div class="search-item" data-route="/patients"><strong>${escapeHTML(p.name)}</strong> <span class="muted">${escapeHTML(p.email || p.phone_number || '')}</span></div>`;
    });
    html += '</div>';
  }
  if (data.encounters?.length) {
    html += '<div class="search-group"><div class="search-group-label">Encounters</div>';
    data.encounters.forEach(e => {
      html += `<div class="search-item" data-route="/encounters"><strong>${escapeHTML(e.patient_name || 'Unknown')}</strong> <span class="muted">${escapeHTML(e.visit_type || '')}</span></div>`;
    });
    html += '</div>';
  }
  if (data.labOrders?.length) {
    html += '<div class="search-group"><div class="search-group-label">Lab Orders</div>';
    data.labOrders.forEach(l => {
      html += `<div class="search-item" data-route="/lab-orders"><strong>${escapeHTML(l.patient_name || 'Unknown')}</strong> <span class="muted">${escapeHTML(l.test_name || l.test_type)}</span></div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  dropdown.innerHTML = html;
  document.body.appendChild(dropdown);

  dropdown.querySelectorAll('.search-item').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      if (route) window.location.hash = route;
      removeSearchResults();
      document.getElementById('global-search').value = '';
    });
  });
}

function removeSearchResults() {
  const existing = document.getElementById('search-dropdown');
  if (existing) existing.remove();
}

// ── Notification Bell ────────────────────────────────────────
function initNotifications() {
  const btn = document.getElementById('notif-btn');
  btn?.addEventListener('click', () => {
    window.location.hash = '/notifications';
  });
}

// ── User Menu ────────────────────────────────────────────────
function initUserMenu() {
  const headerUserBtn  = document.getElementById('header-user-btn');
  const sidebarUserBtn = document.getElementById('sidebar-user-btn');

  const openMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const choice = confirm(
      'User Menu\n\n' +
      '1. View Profile\n' +
      '2. Account Settings\n' +
      '3. Sign Out\n\n' +
      'Click OK for Profile, Cancel for Settings.'
    );
    if (!choice) {
      window.location.hash = '/settings';
    } else {
      window.location.hash = '/profile';
    }
  };

  headerUserBtn?.addEventListener('click', openMenu);
  sidebarUserBtn?.addEventListener('click', openMenu);

  [headerUserBtn, sidebarUserBtn].forEach(btn => {
    btn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openMenu(e);
    });
  });
}

// Sign-out button in profile menu (explicit hookup + red styling class)
function initSignOutButton() {
  const signout = document.getElementById('profile-signout');
  if (!signout) return;
  // Use design-system button tokens for consistency
  signout.classList.add('btn', 'btn-danger');
  // Hook logout
  signout.addEventListener('click', () => {
    try { logout(); } catch (e) { console.error('Logout failed', e); }
  });
}

// ── Hide Inaccessible Nav Items ──────────────────────────────
function applyNavPermissions() {
  const userClass = getUserClass(session);

  // Capability-gated nav (L2): hide items the user lacks the capability for.
  document.querySelectorAll('.mc-nav-item[data-capability]').forEach(el => {
    if (!canAccessCapability(el.dataset.capability)) el.style.display = 'none';
  });

  // Structural-class-gated nav (UI framework): hide features not allowed for
  // the user's class. Rendering source of truth = FEATURE_NAV allowlist.
  document.querySelectorAll('[data-feature]').forEach(el => {
    if (!isFeatureAllowed(el.dataset.feature, userClass)) el.style.display = 'none';
  });

  // Collapse a dropdown parent when every child is hidden (e.g. Clinical).
  document.querySelectorAll('.mc-nav-item').forEach(parent => {
    const dd = parent.querySelector(':scope > .mc-nav-dropdown');
    if (!dd) return;
    const kids = dd.querySelectorAll('.mc-nav-item');
    if (kids.length && [...kids].every(k => k.style.display === 'none')) {
      parent.style.display = 'none';
    }
  });

  // Blank-state fallback when every sidebar item is hidden.
  const visibleNavItems = document.querySelectorAll('.mc-nav-item:not([style*="display: none"])');
  const allNavItems = document.querySelectorAll('.mc-nav-item');
  if (allNavItems.length > 0 && visibleNavItems.length === 0) {
    const navList = document.querySelector('.mc-nav-list');
    if (navList && !navList.querySelector('.mc-nav-empty')) {
      const empty = document.createElement('li');
      empty.className = 'mc-nav-empty';
      empty.innerHTML = '<span class="muted">No modules available for your role.</span>';
      navList.appendChild(empty);
    }
  }

  // Legacy module-gated nav (fallback).
  document.querySelectorAll('.nav-item[data-module]').forEach(el => {
    if (!canAccessModule(el.dataset.module)) el.style.display = 'none';
  });
}

// ── Header Quick Actions (role-aware dropdown) ──────────────
function initQuickActions() {
  const host = document.getElementById('header-quick-actions');
  if (!host) return;
  const actions = getQuickActions(session.role_id, session.department_id);
  renderQuickActions(host, actions, 'Quick Actions');
}

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  populateUser();
  initSidebarToggle();
  initMobileSidebar();
  initSearch();
  initNotifications();
  initUserMenu();
  initSignOutButton();
  applyNavPermissions();
  initQuickActions();

  showToast(`Signed in as ${session.name}`, 'success');
});
