import State from './state.js';
import { getSession } from '../../js/auth.js';
import './sidebar.js';

const outlet = document.getElementById('app-content');
const head = document.head;
let activeFeature = null; // holds returned instance with optional destroy()

function routeNameFromPath(path){
  const p = path.replace(/^\/+/,'').split('/')[0];
  return p || 'dashboard';
}

async function loadFeature(name){
  // remove any previously injected feature stylesheet for cleanliness
  const prev = document.querySelector('link[data-feature-styles]');
  if (prev) prev.remove();
  // if previous feature exposed a destroy hook, call it to remove listeners/subscriptions
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

    // prefer loading css if available (non-blocking)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.setAttribute('data-feature-styles', name);
    link.onerror = ()=> link.remove();
    head.appendChild(link);

    const [mod, tmpl] = await Promise.all([modPromise, tmplPromise]);

    // RBAC: prevent unauthorised access to admin area
    const user = State.getUser();
    if (name === 'admin' && (!user || user.role !== 'admin')) {
      showForbidden();
      return;
    }
    outlet.innerHTML = tmpl;
    if (mod && typeof mod.init === 'function') {
      // allow module to return a cleanup object e.g. { destroy() { ... } }
      try{
        const inst = await mod.init(outlet, State);
        if (inst && typeof inst.destroy === 'function') activeFeature = inst;
      }catch(e){ console.error('Feature init error', e); }
    }
  }catch(err){
    show404(name);
    console.error('Feature load error', err);
  }
}

function show404(name){
  outlet.innerHTML = `<section aria-labelledby="notfound-title"><h2 id="notfound-title">404 — Not Found</h2><p>Module '${name}' not found.</p></section>`;
}

function showForbidden(){
  outlet.innerHTML = `<section aria-labelledby="forbidden-title"><h2 id="forbidden-title">403 — Forbidden</h2><p>You do not have permission to access this area.</p></section>`;
}

function navigate(path){
  history.pushState({},'',path);
  loadRoute(path);
}

function loadRoute(path){
  const name = routeNameFromPath(path);
  loadFeature(name);
}

// Intercept clicks on internal nav links
document.addEventListener('click', (e)=>{
  const a = e.target.closest('a[data-route]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('http') && href.startsWith('/')){
    e.preventDefault();
    navigate(href);
  }
});

window.addEventListener('popstate', ()=> loadRoute(location.pathname));

// initial bootstrap
document.addEventListener('DOMContentLoaded', ()=>{
  // keyboard: allow Enter on brand to go home
  const brand = document.querySelector('.mc-brand');
  if (brand) brand.addEventListener('keydown', (e)=>{ if (e.key==='Enter') navigate('/dashboard'); });

  // Toggle admin nav visibility based on State
  // Initialize State from any existing session (login via login.html)
  try{
    const sess = getSession();
    if (sess){ if (sess.role) sess.role = sess.role.toLowerCase(); State.setUser(sess); }
  }catch(e){ /* ignore */ }
  const adminLink = document.querySelector('.mc-nav-admin');
  const opsLink = document.querySelector('.mc-nav-operations');
  const finLink = document.querySelector('.mc-nav-finance');
  const analyticsLink = document.querySelector('.mc-nav-analytics');
  State.subscribe(s=>{
    if (adminLink) {
      if (s.user && s.user.role === 'admin') adminLink.classList.add('visible'); else adminLink.classList.remove('visible');
    }
    // example role mappings — teams can adapt as needed
    if (opsLink){
      const ok = s.user && ['admin','staff','ops'].includes(s.user.role);
      opsLink.classList.toggle('visible', !!ok);
    }
    if (finLink){
      const ok = s.user && ['admin','finance'].includes(s.user.role);
      finLink.classList.toggle('visible', !!ok);
    }
    if (analyticsLink){
      const ok = s.user && ['admin','analyst'].includes(s.user.role);
      analyticsLink.classList.toggle('visible', !!ok);
    }
  });

  // Secret admin shortcut: Ctrl+Alt+L (or Ctrl+Shift+L on Mac)
  document.addEventListener('keydown',(e)=>{
    const mac = navigator.platform.toUpperCase().includes('MAC');
    const trigger = mac ? (e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='l') : (e.ctrlKey && e.altKey && e.key.toLowerCase()==='l');
    if (trigger){
      e.preventDefault();
      navigate('/secret-login');
    }
  });

  loadRoute(location.pathname);
});

export { navigate, loadRoute };
