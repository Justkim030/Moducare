/**
 * ModuCare MS — App Bootstrap
 * Entry point for the dashboard shell.
 * Runs auth checks, populates user info, wires up UI interactions.
 */
import { requireAuth, logout, getUserRoleLabel, getSession } from './auth.js';
import { initRouter } from './router.js';
import { set } from './store.js';
import { showToast } from './utils.js';

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

  // Cmd/Ctrl + K to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      globalSearch?.focus();
    }
  });

  // Sidebar search trigger
  sidebarSearch?.addEventListener('click', () => globalSearch?.focus());
  sidebarSearch?.addEventListener('keydown', e => {
    if (e.key === 'Enter') globalSearch?.focus();
  });

  globalSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') globalSearch.blur();
  });
}

// ── Notification Bell ────────────────────────────────────────
function initNotifications() {
  const btn = document.getElementById('notif-btn');
  btn?.addEventListener('click', () => {
    showToast('Notification center coming soon.', 'info');
  });
}

// ── User Menu ────────────────────────────────────────────────
function initUserMenu() {
  const headerUserBtn  = document.getElementById('header-user-btn');
  const sidebarUserBtn = document.getElementById('sidebar-user-btn');

  const openMenu = () => {
    // Placeholder — in production, open a dropdown popover
    const actions = ['View Profile', 'Account Settings', 'Sign Out'];
    const choice = prompt(
      'User Menu\n\n' + actions.map((a,i) => `${i+1}. ${a}`).join('\n') +
      '\n\nEnter number:'
    );
    if (choice === '3') logout();
    if (choice === '2') showToast('Account settings coming soon.', 'info');
    if (choice === '1') showToast('Profile view coming soon.', 'info');
  };

  headerUserBtn?.addEventListener('click', openMenu);
  sidebarUserBtn?.addEventListener('click', openMenu);

  [headerUserBtn, sidebarUserBtn].forEach(btn => {
    btn?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openMenu();
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
  import('./auth.js').then(({ canAccessModule }) => {
    document.querySelectorAll('.nav-item[data-module]').forEach(el => {
      const allowed = canAccessModule(el.dataset.module);
      el.style.display = allowed ? '' : 'none';
    });
  });
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
  initRouter();

  showToast(`Signed in as ${session.name}`, 'success');
});
