import State from '../../js/state.js';

const ALLOWED_ROLES = ['admin','staff','ops'];

export async function init(mount, State){
  // RBAC: show friendly forbidden if user lacks access
  const user = State.getUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)){
    mount.innerHTML = `<section aria-labelledby="forbidden"><h2 id="forbidden">403 — Forbidden</h2><p>Operations access requires appropriate permissions.</p></section>`;
    return { destroy(){} };
  }
  const ul = mount.querySelector('#ops-list');
  async function load(){
    try{ const res = await fetch('/api/operations'); const data = await res.json(); render(data); }
    catch(e){ ul.innerHTML = '<li>Failed to load operations</li>'; }
  }
  function render(list){
    if (!list || list.length===0){ ul.innerHTML = '<li>No operations scheduled</li>'; return; }
    ul.innerHTML = list.map(it=>`<li><div>${it.name}</div><div class="mc-muted">${it.owner} · ${it.status}</div></li>`).join('');
  }
  load();
  return { destroy(){ } };
}
