/**
 * ModuCare MS — HR & Staff Module
 * Features: Staff directory grid/table, search & filter,
 *           add staff modal, role badges, status management
 */
import { showToast, formatDate, getInitials, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const link = document.createElement('link');
link.rel = 'stylesheet';
   link.href = '/src/features/staff/hr-staff.css';
  document.head.appendChild(link);
  _cssLoaded = true;
}

window.__STAFF_DATA = [];

async function loadStaff() {
  const roleMap = {
    'role_dev': 'admin',
    'role_nurse': 'staff',
    'lead': 'lead',
    'supervisor': 'supervisor',
    'admin': 'admin'
  };
  try {
    const data = await apiFetch('/users');
    if (!data.ok) throw new Error(data?.error || 'Failed');
    window.__STAFF_DATA = (data.users || []).map(u => ({
      id: u.id,
      name: u.name,
      initials: (u.name || '').split(' ').map(p => p[0]).join('').toUpperCase() || '??',
      department: u.department || 'Unassigned',
      role: roleMap[u.role] || 'staff',
      status: 'active',
      email: u.email,
      phone: u.phone_number || '—',
      joined: u.joined || new Date().toISOString().split('T')[0],
      location: 'Main Office'
    }));
  } catch (e) {
    showToast('Failed to load staff directory', 'error');
  }
}

const DEPT_OPTIONS = [
  'All Departments','System Administration','Operations','Finance & Billing',
  'HR','Audit & Compliance','Analytics','Document Vault',
];

const ROLE_MAP = {
  admin:     { label:'Admin',      badge:'badge-danger',   hex:'#DC2626' },
  director:  { label:'Director',   badge:'badge-primary',  hex:'#1E5799' },
  supervisor:{ label:'Supervisor', badge:'badge-warning',  hex:'#D97706' },
  lead:      { label:'Team Lead',  badge:'badge-accent',   hex:'#0F7A75' },
  staff:     { label:'Staff',      badge:'badge-neutral',  hex:'#5C728A' },
};

const STATUS_MAP = {
  active:   { dot:'status-dot--active',   badge:'badge-success', label:'Active'   },
  pending:  { dot:'status-dot--pending',  badge:'badge-warning', label:'Pending'  },
  inactive: { dot:'status-dot--inactive', badge:'badge-neutral', label:'Inactive' },
};

let _state = {
  search: '',
  dept:   'All Departments',
  status: 'all',
  view:   'table',
  page:   1,
  perPage: 8,
};

export async function init(mount, State) {
   injectCSS();
   mount.innerHTML = buildShell();
   bindEvents(mount);
   await loadStaff();
   renderList(mount);
   return { destroy: () => {} };
}

function buildShell() {
  const canAdd = hasRole('lead');
  return `
  <div class="section-header">
    <div>
      <div class="section-title">HR & Staff Directory</div>
      <div class="section-subtitle">Manage all staff profiles, roles, and employment status across departments.</div>
    </div>
    <div class="flex gap-3">
      ${canAdd ? `<button class="btn btn-primary" id="add-staff-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Staff Member
      </button>` : ''}
      <button class="btn btn-secondary" id="export-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export CSV
      </button>
    </div>
  </div>

  <div class="hr-stats" id="hr-stats"></div>

  <div class="filter-bar">
    <div class="filter-search">
      <span class="filter-search__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </span>
      <input type="search" id="staff-search" placeholder="Search by name, email, or department…" value="${_state.search}" />
    </div>

    <select class="filter-select" id="dept-filter">
      ${DEPT_OPTIONS.map(d=>`<option value="${d}" ${_state.dept===d?'selected':''}>${d}</option>`).join('')}
    </select>

    <select class="filter-select" id="status-filter">
      <option value="all"      ${_state.status==='all'     ?'selected':''}>All Statuses</option>
      <option value="active"   ${_state.status==='active'  ?'selected':''}>Active</option>
      <option value="pending"  ${_state.status==='pending' ?'selected':''}>Pending</option>
      <option value="inactive" ${_state.status==='inactive'?'selected':''}>Inactive</option>
    </select>

    <div class="flex gap-2 items-center" style="margin-left:auto">
      <button class="btn btn-ghost btn-sm view-toggle ${_state.view==='table'?'active':''}" data-view="table" title="Table view">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
      </button>
      <button class="btn btn-ghost btn-sm view-toggle ${_state.view==='grid'?'active':''}" data-view="grid" title="Grid view">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      </button>
    </div>
  </div>

  <div id="staff-list"></div>

  <div id="staff-pagination"></div>

  <div class="modal-overlay hidden" id="add-staff-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal modal--lg">
      <div class="modal__header">
        <div>
          <div class="modal__title" id="modal-title">Add New Staff Member</div>
          <div class="modal__subtitle">Fill in the details to create a new staff profile.</div>
        </div>
        <button class="modal__close" id="modal-close" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal__body">
        <form id="add-staff-form" novalidate>
          <div class="form-section">
            <div class="form-section__title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Personal Information
            </div>
            <div class="form-row">
              <div class="input-group">
                <label class="input-label" for="f-first">First Name *</label>
                <input type="text" id="f-first" class="input" placeholder="Jane" required />
              </div>
              <div class="input-group">
                <label class="input-label" for="f-last">Last Name *</label>
                <input type="text" id="f-last" class="input" placeholder="Doe" required />
              </div>
            </div>
            <div class="form-row" style="margin-top:var(--sp-4)">
              <div class="input-group">
                <label class="input-label" for="f-email">Work Email *</label>
                <input type="email" id="f-email" class="input" placeholder="jane.doe@org.com" required />
              </div>
              <div class="input-group">
                <label class="input-label" for="f-phone">Phone Number</label>
                <input type="tel" id="f-phone" class="input" placeholder="(555) 000-0000" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section__title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="2"/></svg>
              Employment Details
            </div>
            <div class="form-row">
              <div class="input-group">
                <label class="input-label" for="f-dept">Department *</label>
                <select id="f-dept" class="input filter-select" style="padding:0.5625rem 0.875rem" required>
                  <option value="">Select department</option>
                  ${DEPT_OPTIONS.slice(1).map(d=>`<option>${d}</option>`).join('')}
                </select>
              </div>
              <div class="input-group">
                <label class="input-label" for="f-role">Role *</label>
                <select id="f-role" class="input filter-select" style="padding:0.5625rem 0.875rem" required>
                  <option value="">Select role</option>
                  ${Object.entries(ROLE_MAP).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row" style="margin-top:var(--sp-4)">
              <div class="input-group">
                <label class="input-label" for="f-start">Start Date *</label>
                <input type="date" id="f-start" class="input" required />
              </div>
              <div class="input-group">
                <label class="input-label" for="f-location">Work Location</label>
                <select id="f-location" class="input filter-select" style="padding:0.5625rem 0.875rem">
                  <option>Main Office</option>
                  <option>Branch A</option>
                  <option>Branch B</option>
                  <option>Remote</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      </div>
      <div class="modal__footer">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save">Save Staff Member</button>
      </div>
    </div>
  </div>`;
}

function renderList(mount) {
  const filtered = filterStaff();
  const total    = filtered.length;
  const pages    = Math.ceil(total / _state.perPage);
  const start    = (_state.page - 1) * _state.perPage;
  const slice    = filtered.slice(start, start + _state.perPage);

  const statsEl = mount.querySelector('#hr-stats');
  if (statsEl) statsEl.innerHTML = buildStatsBar();

  const listEl = mount.querySelector('#staff-list');
  if (!listEl) return;

  if (slice.length === 0) {
    listEl.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">No staff found</div>
      <div class="empty-state__desc">Try adjusting your search or filter criteria.</div>
    </div>`;
  } else if (_state.view === 'grid') {
    listEl.innerHTML = `<div class="staff-grid">${slice.map(staffCard).join('')}</div>`;
  } else {
    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Staff Member</th><th>Department</th><th>Role</th>
            <th>Status</th><th>Location</th><th>Joined</th><th></th>
          </tr></thead>
          <tbody>${slice.map(staffRow).join('')}</tbody>
        </table>
      </div>`;
  }

  const pagEl = mount.querySelector('#staff-pagination');
  if (pagEl) pagEl.innerHTML = pages > 1 ? buildPagination(pages) : '';
}

function buildStatsBar() {
  const active   = __STAFF_DATA.filter(s=>s.status==='active').length;
  const pending  = __STAFF_DATA.filter(s=>s.status==='pending').length;
  const inactive = __STAFF_DATA.filter(s=>s.status==='inactive').length;
  return `<div class="hr-stats-row">
    <div class="hr-stat"><span class="hr-stat__val">${__STAFF_DATA.length}</span><span class="hr-stat__lbl">Total Staff</span></div>
    <div class="hr-stat"><span class="hr-stat__val" style="color:var(--clr-success)">${active}</span><span class="hr-stat__lbl">Active</span></div>
    <div class="hr-stat"><span class="hr-stat__val" style="color:var(--clr-warning)">${pending}</span><span class="hr-stat__lbl">Pending</span></div>
    <div class="hr-stat"><span class="hr-stat__val" style="color:var(--clr-neutral-400)">${inactive}</span><span class="hr-stat__lbl">Inactive</span></div>
    <div class="hr-stat"><span class="hr-stat__val">${[...new Set(__STAFF_DATA.map(s=>s.department))].length}</span><span class="hr-stat__lbl">Departments</span></div>
  </div>`;
}

function staffRow(s) {
  const r = ROLE_MAP[s.role]   || ROLE_MAP.staff;
  const st= STATUS_MAP[s.status]|| STATUS_MAP.inactive;
  return `<tr>
    <td><div class="flex items-center gap-3">
      <div class="avatar avatar-md" style="background:var(--clr-primary-100);color:var(--clr-primary-600)">${s.initials}</div>
      <div>
        <div style="font-weight:600;color:var(--text-primary)">${escapeHTML(s.name)}</div>
        <div style="font-size:0.8125rem;color:var(--text-secondary)">${escapeHTML(s.email)}</div>
      </div>
    </div></td>
    <td class="text-secondary">${escapeHTML(s.department)}</td>
    <td><span class="badge ${r.badge}">${r.label}</span></td>
    <td><span class="badge ${st.badge}"><span class="status-dot ${st.dot}"></span>${st.label}</span></td>
    <td class="text-secondary">${escapeHTML(s.phone)}</td>
    <td class="text-secondary text-sm">${formatDate(s.joined)}</td>
    <td>
      <div class="flex gap-1 justify-end">
        <button class="btn btn-ghost btn-sm btn-icon" data-tip="View Profile" data-action="view" data-id="${s.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </td>
  </tr>`;
}

function staffCard(s) {
  const r  = ROLE_MAP[s.role]    || ROLE_MAP.staff;
  const st = STATUS_MAP[s.status]|| STATUS_MAP.inactive;
  return `<div class="staff-card">
    <div class="staff-card__top">
      <div class="avatar avatar-xl" style="background:var(--clr-primary-100);color:var(--clr-primary-600);font-size:1.25rem">${s.initials}</div>
      <span class="badge ${st.badge}" style="margin-left:auto"><span class="status-dot ${st.dot}"></span>${st.label}</span>
    </div>
    <div class="staff-card__name">${escapeHTML(s.name)}</div>
    <div class="staff-card__dept">${escapeHTML(s.department)}</div>
    <span class="badge ${r.badge}">${r.label}</span>
    <div class="staff-card__meta">
      <span>📍 ${escapeHTML(s.location)}</span>
      <span>📅 ${formatDate(s.joined)}</span>
    </div>
    <div class="staff-card__email">${escapeHTML(s.email)}</div>
  </div>`;
}

function buildPagination(pages, total) {
  const start = (_state.page - 1) * _state.perPage + 1;
  const end   = Math.min(_state.page * _state.perPage, total);
  let btns = `<button class="page-btn" ${_state.page===1?'disabled':''} data-page="${_state.page-1}">‹</button>`;
  for (let i=1;i<=pages;i++) {
    btns += `<button class="page-btn ${i===_state.page?'active':''}" data-page="${i}">${i}</button>`;
  }
  btns += `<button class="page-btn" ${_state.page===pages?'disabled':''} data-page="${_state.page+1}">›</button>`;
  return `<div class="pagination">${btns}<span class="pagination__info">${start}–${end} of ${total}</span></div>`;
}

function filterStaff() {
  return __STAFF_DATA.filter(s => {
    const q = _state.search.toLowerCase();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q);
    const matchDept   = _state.dept === 'All Departments' || s.department === _state.dept;
    const matchStatus = _state.status === 'all' || s.status === _state.status;
    return matchSearch && matchDept && matchStatus;
  });
}

function bindEvents(mount) {
  const search = mount.querySelector('#staff-search');
  let debounce;
  search?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      _state.search = search.value;
      _state.page = 1;
      renderList(mount);
    }, 280);
  });

  mount.querySelector('#dept-filter')?.addEventListener('change', e => {
    _state.dept = e.target.value; _state.page = 1; renderList(mount);
  });

  mount.querySelector('#status-filter')?.addEventListener('change', e => {
    _state.status = e.target.value; _state.page = 1; renderList(mount);
  });

  mount.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.view = btn.dataset.view;
      mount.querySelectorAll('.view-toggle').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderList(mount);
    });
  });

  mount.querySelector('#staff-pagination')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    _state.page = parseInt(btn.dataset.page);
    renderList(mount);
  });

  const modal = mount.querySelector('#add-staff-modal');
  const addBtn = mount.querySelector('#add-staff-btn');
  const closeBtn = mount.querySelector('#modal-close');
  const cancelBtn = mount.querySelector('#modal-cancel');
  const saveBtn = mount.querySelector('#modal-save');

  const openModal = () => modal?.classList.remove('hidden');
  const closeModal = () => modal?.classList.add('hidden');

  addBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  saveBtn?.addEventListener('click', async () => {
    const first = mount.querySelector('#f-first')?.value.trim();
    const last  = mount.querySelector('#f-last')?.value.trim();
    const email = mount.querySelector('#f-email')?.value.trim();
    const dept  = mount.querySelector('#f-dept')?.value;
    const role  = mount.querySelector('#f-role')?.value;
    const phone = mount.querySelector('#f-phone')?.value.trim();
    if (!first||!last||!email||!dept||!role) {
      showToast('Please fill in all required fields.', 'warning'); return;
    }
    try {
      const data = await apiFetch('/register', {
        method: 'POST',
        body: JSON.stringify({
          name: `${first} ${last}`,
          email,
          phone_number: phone || null,
          password: 'temp_' + Math.random().toString(36).slice(2, 8),
          role_id: role,
        })
      });
      if (!data.ok) throw new Error(data?.error || 'Failed');
      closeModal();
      await loadStaff();
      _state.page = 1;
      renderList(mount);
      showToast(`${first} ${last} added successfully.`, 'success');
      mount.querySelector('#add-staff-form')?.reset();
    } catch (e) {
      showToast(e.message || 'Failed to add staff', 'error');
    }
  });

  mount.querySelector('#export-btn')?.addEventListener('click', () => {
    import('../../js/utils.js').then(({ exportCSV }) => {
      const rows = [
        ['Name','Department','Role','Status','Email','Phone','Location','Joined'],
        ...__STAFF_DATA.map(s=>[s.name,s.department,ROLE_MAP[s.role]?.label,s.status,s.email,s.phone,s.location,s.joined])
      ];
      exportCSV(rows, 'moducare-staff-directory.csv');
      showToast('Staff directory exported as CSV.', 'success');
    });
  });
}