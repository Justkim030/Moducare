/* Sidebar module - handles collapse and toggle button */

const BREAKPOINT = 700; // px
const LS_KEY = 'mc_sidebar_collapsed';

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

  const headerActions = document.querySelector('.mc-header-actions');
  if (headerActions && !document.getElementById('mc-sidebar-toggle')) {
    const btn = createToggleButton();
    btn.addEventListener('click', ()=>{
      const isCollapsed = sidebar.classList.contains('collapsed');
      setCollapsed(sidebar, !isCollapsed);
    });
    headerActions.insertBefore(btn, headerActions.firstChild);
  }

  function applyPreference() {
    const pref = (()=>{ try { return localStorage.getItem(LS_KEY); } catch(e){ return null; }})();
    if (pref === '1') setCollapsed(sidebar, true);
    else if (pref === '0') setCollapsed(sidebar, false);
  }

  function onResize(){
    if (window.innerWidth <= BREAKPOINT) {
      setCollapsed(sidebar, true);
    } else {
      applyPreference();
    }
  }

  applyPreference();
  onResize();
  window.addEventListener('resize', onResize);
}

// Auto-init when module loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default { init };