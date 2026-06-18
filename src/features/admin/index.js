import State from '../../js/state.js';

const ALLOWED = ['admin'];

export async function init(mount, State){
  const user = State.getUser();
  if (!user || !ALLOWED.includes(user.role)){
    mount.innerHTML = `<section aria-labelledby="forbidden-admin"><h2 id="forbidden-admin">403 — Forbidden</h2><p>Admin area requires admin role.</p></section>`;
    return { destroy(){} };
  }

  const wrap = mount.querySelector('#users-table-wrap');
  const refreshBtn = mount.querySelector('#refresh-users');
  refreshBtn?.addEventListener('click', load);

  async function load(){
    wrap.innerHTML = 'Loading…';
    try{
      const res = await fetch('/api/users');
      const data = await res.json();
      render(data);
    }catch(e){ wrap.innerHTML = '<div class="mc-muted">Failed to load users</div>'; }
  }

  function render(users){
    if (!users || users.length===0){ wrap.innerHTML = '<div>No users</div>'; return; }
    wrap.innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead><tbody>${users.map(u=>`<tr data-id="${u.id}"><td class="name">${u.name||''}</td><td class="email">${u.email||''}</td><td class="role">${u.role||''}</td><td class="user-actions"><button class="btn btn-secondary btn-sm edit">Edit</button><button class="btn btn-danger btn-sm delete">Delete</button></td></tr>`).join('')}</tbody></table>`;
    // bind actions
    wrap.querySelectorAll('.delete').forEach(b=> b.addEventListener('click', onDelete));
    wrap.querySelectorAll('.edit').forEach(b=> b.addEventListener('click', onEdit));
  }

  async function onDelete(e){
    const tr = e.target.closest('tr');
    const id = tr.getAttribute('data-id');
    if (!confirm('Delete user '+tr.querySelector('.name').textContent+'?')) return;
    try{
      const res = await fetch('/api/users/'+id, { method:'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) { load(); return; }
      alert(data.error || 'Delete failed');
    }catch(err){ alert('Network error'); }
  }

  function onEdit(e){
    const tr = e.target.closest('tr');
    const id = tr.getAttribute('data-id');
    const name = tr.querySelector('.name').textContent;
    const email = tr.querySelector('.email').textContent;
    const role = tr.querySelector('.role').textContent;
    tr.innerHTML = `<td><input class="input edit-name" value="${name}"/></td><td><input class="input edit-email" value="${email}"/></td><td><select class="input edit-role"><option value="staff">staff</option><option value="lead">lead</option><option value="admin">admin</option></select></td><td><button class="btn btn-primary btn-sm save">Save</button><button class="btn btn-ghost btn-sm cancel">Cancel</button></td>`;
    tr.querySelector('.edit-role').value = role||'staff';
    tr.querySelector('.cancel').addEventListener('click', load);
    tr.querySelector('.save').addEventListener('click', async ()=>{
      const n = tr.querySelector('.edit-name').value.trim();
      const eMail = tr.querySelector('.edit-email').value.trim();
      const r = tr.querySelector('.edit-role').value;
      try{
        const res = await fetch('/api/users/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:n, email:eMail, role:r }) });
        const data = await res.json();
        if (res.ok && data.ok){ load(); return; }
        alert(data.error || 'Save failed');
      }catch(err){ alert('Network error'); }
    });
  }

  load();
  return { destroy(){ } };
}
