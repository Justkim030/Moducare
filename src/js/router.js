import State from './state.js';
import { getSession, canAccessCapability, MODULE_CAPABILITIES, DEPARTMENT_MODULES } from '../../js/auth.js';
import { showToast } from '../../js/utils.js';
import './sidebar.js';

const outlet = document.getElementById('app-content');
const head = document.head;
let activeFeature = null;

const AUTH_ROUTES = ['login', 'secret-login'];

function routeNameFromPath(path){
  let p = path.replace(/^\/+/,'').split('/')[0];
  p = p.replace(/\.html$/, '');
  if (p === 'index') return 'dashboard';
  return p || 'dashboard';
}

function canAccessFeature(name){
  const cap = MODULE_CAPABILITIES[name];
  return !cap || canAccessCapability(cap);
}

/**
 * Dynamically toggles the structural app layout shell visibility
 */
function toggleAppShellVisibility(isAuthPage) {
  const header = document.querySelector('.mc-header');
  const sidebar = document.querySelector('.mc-sidebar');
  const footer = document.querySelector('.mc-footer');
  const appContainer = document.getElementById('mc-app');

  if (isAuthPage) {
    if (header) header.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (appContainer) {
      appContainer.style.width = '100vw';
      appContainer.style.height = '100vh';
      appContainer.style.display = 'block';
    }
  } else {
    if (header) header.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'block';
    if (footer) footer.style.display = 'block';
    if (appContainer) {
      appContainer.style.width = ''; 
      appContainer.style.height = '';
      appContainer.style.display = 'flex'; 
    }
  }
}

function updateActiveLinks(path) {
  document.querySelectorAll('.mc-nav-link').forEach(link => link.classList.remove('active'));
  
  const exactMatch = document.querySelector(`.mc-nav-link[href="${path}"]`);
  if (exactMatch) {
    exactMatch.classList.add('active');
    if (exactMatch.classList.contains('sub')) {
      const parentItem = exactMatch.closest('.mc-nav-item');
      if (parentItem && parentItem.style.display !== 'none') {
        parentItem.classList.add('expanded');
      }
    }
  } else {
    const feature = routeNameFromPath(path);
    document.querySelector(`.mc-nav-link[href="/${feature}"]`)?.classList.add('active');
  }
}

async function loadFeature(name, subView){
   const prev = document.querySelector('link[data-feature-styles]');
   if (prev) prev.remove();
   
   try{
     if (activeFeature && typeof activeFeature.destroy === 'function'){
       activeFeature.destroy();
     }
   }catch(e){ console.warn('Error during feature destroy', e); }
   activeFeature = null;

   try{
     const modPromise = import(`/src/features/${name}/index.js`);
     const tmplPromise = fetch(`/src/features/${name}/template.html`).then(r=>r.ok? r.text(): Promise.reject(r.status));
     const cssHref = `/src/features/${name}/styles.css`;

     const link = document.createElement('link');
     link.rel = 'stylesheet';
     link.href = cssHref;
     link.setAttribute('data-feature-styles', name);
     link.onerror = ()=> link.remove();
     head.appendChild(link);

      const [mod, tmpl] = await Promise.all([modPromise, tmplPromise]);

      if (!canAccessFeature(name)) {
        showForbidden();
        return;
      }

     const targetOutlet = AUTH_ROUTES.includes(name)
       ? document.getElementById('mc-app')
       : outlet;

     if (targetOutlet) {
       targetOutlet.innerHTML = tmpl;
       if (mod && typeof mod.init === 'function') {
         try{
           const inst = await mod.init(targetOutlet, State, subView);
           if (inst && typeof inst.destroy === 'function') activeFeature = inst;
         }catch(e){ console.error('Feature init error', e); }
       }
     }
   }catch(err){
     show404(name);
     console.error('Feature load error', err);
   }
 }

function show404(name){
  showToast(`Module '${name}' not found.`, 'error');
  outlet.innerHTML = `<section aria-labelledby="notfound-title"><h2 id="notfound-title">404 — Not Found</h2><p>Module '${name}' not found.</p></section>`;
}

function showForbidden(){
  showToast('You do not have permission to access this area.', 'error');
  navigate('/access-denied');
}

function navigate(path){
  history.pushState({},'',path);
  loadRoute(path);
}

function loadRoute(path){
  const segments = path.replace(/^\/+|\/+$/g, '').split('/');
  let name = segments[0] || 'dashboard';
  // Normalize entry paths like /index.html -> dashboard (mirrors routeNameFromPath)
  name = name.replace(/\.html$/, '');
  if (name === 'index') name = 'dashboard';
  let subView = null;

  const dropdownParents = ['dashboard', 'patients', 'staff', 'finance-billing', 'operations', 'clinical', 'communications'];
  if (path.includes('/') && dropdownParents.some(p => name === p)) {
    subView = segments[1] || null;
    name = name.split('/')[0];
  }

  if (name === 'login') {
    window.location.href = 'login.html';
    return;
  }

  const isAuthPage = AUTH_ROUTES.includes(name);
  toggleAppShellVisibility(isAuthPage);

  updateActiveLinks(path);
  loadFeature(name, subView).then(() => {
    outlet?.focus();
  });
}

document.addEventListener('click', (e)=>{
  const a = e.target.closest('a[data-route]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/')) return;
  
  // Profile menu click outside sidebar
  if (a.classList.contains('mc-profile-item')) return;
  
  // Handle dropdown parent links - first click opens dropdown, keep it open
  const parentItem = a.closest('.mc-nav-item');
  const dropdown = parentItem?.querySelector('.mc-nav-dropdown');
  
  if (dropdown && !a.classList.contains('sub')) {
    e.preventDefault();
    document.querySelectorAll('.mc-nav-item').forEach(li => {
      if (li !== parentItem) li.classList.remove('expanded');
    });
    parentItem.classList.toggle('expanded');
    // Don't navigate on parent click - let user select submenu item
    return;
  }
  
  e.preventDefault();
  navigate(href);
});

window.addEventListener('popstate', ()=> loadRoute(location.pathname));

document.addEventListener('DOMContentLoaded', () => {
  const brand = document.querySelector('.mc-brand');
  if (brand) brand.addEventListener('keydown', (e)=>{ if (e.key==='Enter') navigate('/dashboard'); });
  
  const profile = document.getElementById('profile');
  const profileBtn = document.getElementById('profile-btn');
  profileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    profile.classList.toggle('menu-active');
  });
  document.addEventListener('click', () => profile.classList.remove('menu-active'));
  
  document.getElementById('profile-signout')?.addEventListener('click', () => {
    import('/js/auth.js').then(({ logout }) => logout());
  });

  try{
    const sess = getSession();
    if (sess){ if (sess.role) sess.role = sess.role.toLowerCase(); State.setUser(sess); }
  }catch(e){ /* ignore */ }

  // Filter nav by department for non-admin users
  const sess = getSession();
  if (sess && sess.role !== 'admin' && sess.department_id) {
    const allowedModules = DEPARTMENT_MODULES[sess.department_id] || [];
    document.querySelectorAll('.mc-nav-link:not(.sub)').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const module = href.replace(/^\//, '').split('/')[0];
      const parentItem = link.closest('.mc-nav-item');
      
      if (module && !allowedModules.includes(module) && module !== 'dashboard') {
        parentItem?.classList.add('department-hidden');
      }
    });
  }

  loadRoute(location.pathname);
});

export { navigate, loadRoute };