/* Small sidebar collapse/expand utility
   - auto-collapses at `breakpoint` width
   - provides a header toggle to manually override
   - saves user preference in localStorage
   - filters navigation by department for staff users
*/
import { getSession } from '../../js/auth.js';
import { DEPARTMENT_MODULES } from '../../js/auth.js';

const BREAKPOINT = 700; // px
const LS_KEY = 'mc_sidebar_collapsed';

function filterNavByDepartment() {
  const session = getSession();
  if (!session) return;
  
  const userRole = session.role;
  const userDept = session.department_name;
  
  // For staff users, filter nav links by department
  if (userRole === 'staff' && userDept && DEPARTMENT_MODULES[userDept]) {
    const allowedModules = DEPARTMENT_MODULES[userDept];
    document.querySelectorAll('.mc-nav-link').forEach(link => {
      const href = link.getAttribute('href');
      const module = href?.replace(/^\//, '').split('/')[0];
      if (module && !allowedModules.includes(module) && module !== 'dashboard') {
        link.closest('li')?.classList.add('department-hidden');
      }
    });
  }
}

function createToggleButton() {
  const btn = document.createElement('button');
  btn.id = 'mc-sidebar-toggle';
  btn.className = 'mc-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle sidebar');
  btn.innerText = '☰';
  return btn;
}

function setCollapsed(sidebar, collapsed) {
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed', !!collapsed);
  try { localStorage.setItem(LS_KEY, collapsed ? '1' : '0'); } catch(e){}
}

function init() {
  const sidebar = document.querySelector('.mc-sidebar');
  if (!sidebar) return;

  // add toggle to header actions
  const headerActions = document.querySelector('.mc-header-actions');
  if (headerActions && !document.getElementById('mc-sidebar-toggle')) {
    const btn = createToggleButton();
    btn.addEventListener('click', ()=>{
      const isCollapsed = sidebar.classList.contains('collapsed');
      setCollapsed(sidebar, !isCollapsed);
    });
    headerActions.insertBefore(btn, headerActions.firstChild);
  }

  // Respect user pref when above breakpoint
  function applyPreference() {
    const pref = (()=>{ try { return localStorage.getItem(LS_KEY); } catch(e){ return null; }})();
    if (pref === '1') setCollapsed(sidebar, true);
    else if (pref === '0') setCollapsed(sidebar, false);
  }

  function onResize(){
    if (window.innerWidth <= BREAKPOINT) {
      // force collapsed on narrow viewports (but keep pref stored)
      setCollapsed(sidebar, true);
    } else {
      // large screens: honor explicit preference or default expanded
      applyPreference();
    }
  }

  // initialize
  applyPreference();
  onResize();
  filterNavByDepartment();
  window.addEventListener('resize', onResize);
}

// Auto-init when module loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default { init };