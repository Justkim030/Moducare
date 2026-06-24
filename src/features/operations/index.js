/**
 * ModuCare MS — Operations & Task Tracking Module
 * Features: Kanban-style task board, task list, status pipeline,
 *           new task form, priority levels, assignment
 */
import { showToast, formatDate, escapeHTML } from '../../../js/utils.js';
import { hasRole }               from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';   l.href = 'src/features/operations/operations-tasks.css';
  document.head.appendChild(l); _cssLoaded = true;
}

// ── Mock Data ────────────────────────────────────────────────
let TASKS = [
  { id:'t001', title:'Update service agreements for Q1',   dept:'Operations',      priority:'high',   status:'active',    assignee:'Marcus Rivera',  due:'2025-01-18', tags:['agreement','billing'], notes:'Coordinate with Finance.' },
  { id:'t002', title:'Conduct new hire orientation',       dept:'HR',              priority:'medium', status:'referred',  assignee:'Alex Liu',        due:'2025-01-28', tags:['onboarding'], notes:'' },
  { id:'t003', title:'Monthly compliance audit report',    dept:'Audit',           priority:'high',   status:'pending',   assignee:'Priya Joshi',     due:'2025-01-22', tags:['compliance','report'], notes:'Requires director sign-off.' },
  { id:'t004', title:'Process timesheets for Dec payroll', dept:'Finance',         priority:'urgent', status:'active',    assignee:'Sara Okonkwo',    due:'2025-01-10', tags:['payroll','timesheet'], notes:'' },
  { id:'t005', title:'Deploy staff portal update v2.1',    dept:'System Admin',    priority:'medium', status:'completed', assignee:'Jane Doe',        due:'2025-01-05', tags:['system','deploy'], notes:'Completed on schedule.' },
  { id:'t006', title:'Renew annual insurance certificates', dept:'Operations',     priority:'high',   status:'referred',  assignee:'Derek Walsh',     due:'2025-02-01', tags:['insurance','renewal'], notes:'' },
  { id:'t007', title:'Analytics dashboard data refresh',   dept:'Analytics',       priority:'low',    status:'pending',   assignee:'Tomás Guerrero',  due:'2025-01-25', tags:['analytics'], notes:'' },
  { id:'t008', title:'Archive inactive client records',    dept:'Document Vault',  priority:'low',    status:'completed', assignee:'Mei Tanaka',      due:'2025-01-08', tags:['archive','records'], notes:'' },
  { id:'t009', title:'Staff skills assessment rollout',    dept:'HR',              priority:'medium', status:'active',    assignee:'Alex Liu',        due:'2025-02-10', tags:['training'], notes:'' },
  { id:'t010', title:'Quarterly board meeting prep',       dept:'Operations',      priority:'urgent', status:'active',    assignee:'Marcus Rivera',   due:'2025-01-30', tags:['meeting','exec'], notes:'Slides due 3 days before.' },
];

const STATUSES = [
  { id:'referred',  label:'Referred',  color:'#5B9ED6', bg:'#EEF5FB' },
  { id:'pending',   label:'Pending',   color:'#D97706', bg:'#FEF3C7' },
  { id:'active',    label:'Active',    color:'#0F7A75', bg:'#D4F8F6' },
  { id:'completed', label:'Completed', color:'#16A34A', bg:'#DCFCE7' },
];
const PRIORITIES = {
  urgent: { label:'Urgent', color:'#DC2626', bg:'#FEE2E2' },
  high:   { label:'High',   color:'#D97706', bg:'#FEF3C7' },
  medium: { label:'Medium', color:'#1E5799', bg:'#EEF5FB' },
  low:    { label:'Low',    color:'#5C728A', bg:'#F6F8FA' },
};

let _state = { view:'board', filterStatus:'all', filterPriority:'all', search:'' };

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  renderBoard(container);
}

function buildShell() {
  return `
  <div class="section-header">
    <div>
      <div class="section-title">Operations &amp; Task Tracking</div>
      <div class="section-subtitle">Track departmental tasks from assignment to completion across your organization.</div>
    </div>
    <div class="flex gap-3">
      <button class="btn btn-primary" id="new-task-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Task
      </button>
    </div>
  </div>

  <!-- Pipeline Summary -->
  <div class="ops-pipeline" id="ops-pipeline"></div>

  <!-- Filters -->
  <div class="filter-bar">
    <div class="filter-search">
      <span class="filter-search__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </span>
      <input type="search" id="task-search" placeholder="Search tasks…" />
    </div>
    <select class="filter-select" id="task-status-filter">
      <option value="all">All Statuses</option>
      ${STATUSES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}
    </select>
    <select class="filter-select" id="task-priority-filter">
      <option value="all">All Priorities</option>
      ${Object.entries(PRIORITIES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
    </select>
    <div class="flex gap-2 items-center" style="margin-left:auto">
      <button class="btn btn-ghost btn-sm view-toggle ${_state.view==='board'?'active':''}" data-view="board" title="Board view">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      </button>
      <button class="btn btn-ghost btn-sm view-toggle ${_state.view==='list'?'active':''}" data-view="list" title="List view">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
    </div>
  </div>

  <!-- Board / List Area -->
  <div id="ops-content"></div>

  <!-- New Task Modal -->
  <div class="modal-overlay hidden" id="task-modal" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal__header">
        <div>
          <div class="modal__title">Create New Task</div>
          <div class="modal__subtitle">Assign a task to a department and team member.</div>
        </div>
        <button class="modal__close" id="task-modal-close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal__body" style="display:flex;flex-direction:column;gap:var(--sp-5)">
        <div class="input-group">
          <label class="input-label" for="t-title">Task Title *</label>
          <input type="text" id="t-title" class="input" placeholder="Describe the task clearly…" />
        </div>
        <div class="form-row">
          <div class="input-group">
            <label class="input-label" for="t-dept">Department *</label>
            <select id="t-dept" class="input filter-select" style="padding:0.5625rem 0.875rem">
              <option>Operations</option><option>HR</option><option>Finance</option>
              <option>Audit</option><option>Analytics</option><option>System Admin</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label" for="t-priority">Priority *</label>
            <select id="t-priority" class="input filter-select" style="padding:0.5625rem 0.875rem">
              ${Object.entries(PRIORITIES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label class="input-label" for="t-assignee">Assignee</label>
            <input type="text" id="t-assignee" class="input" placeholder="e.g. Marcus Rivera" />
          </div>
          <div class="input-group">
            <label class="input-label" for="t-due">Due Date</label>
            <input type="date" id="t-due" class="input" />
          </div>
        </div>
        <div class="input-group">
          <label class="input-label" for="t-notes">Notes</label>
          <textarea id="t-notes" class="input" rows="3" placeholder="Add any relevant notes or context…" style="resize:vertical"></textarea>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn-secondary" id="task-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="task-modal-save">Create Task</button>
      </div>
    </div>
  </div>`;
}

function renderBoard(container) {
  // Pipeline stats
  const pipeEl = container.querySelector('#ops-pipeline');
  if (pipeEl) {
    pipeEl.innerHTML = `<div class="ops-pipeline-row">
      ${STATUSES.map(s => {
        const count = TASKS.filter(t=>t.status===s.id).length;
        return `<div class="ops-stage" style="border-top:3px solid ${s.color}">
          <span class="ops-stage__count" style="color:${s.color}">${count}</span>
          <span class="ops-stage__label">${s.label}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  const filtered = filterTasks();
  const content  = container.querySelector('#ops-content');
  if (!content) return;

  if (_state.view === 'board') {
    content.innerHTML = `<div class="task-board">
      ${STATUSES.map(s => {
        const col = filtered.filter(t=>t.status===s.id);
        return `<div class="task-col">
          <div class="task-col__header" style="border-bottom:2px solid ${s.color}">
            <span class="task-col__title">${s.label}</span>
            <span class="badge" style="background:${s.bg};color:${s.color}">${col.length}</span>
          </div>
          <div class="task-col__body">
            ${col.length===0
              ? `<div style="padding:var(--sp-6);text-align:center;color:var(--text-tertiary);font-size:0.8125rem">No tasks</div>`
              : col.map(taskCard).join('')
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;
  } else {
    content.innerHTML = filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__title">No tasks found</div><div class="empty-state__desc">Try adjusting your filters.</div></div>`
      : `<div class="table-wrap"><table class="table">
          <thead><tr><th>Task</th><th>Department</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Due Date</th></tr></thead>
          <tbody>${filtered.map(taskRow).join('')}</tbody>
        </table></div>`;
  }
}

function taskCard(t) {
  const p = PRIORITIES[t.priority] || PRIORITIES.medium;
  const overdue = t.due && new Date(t.due) < new Date() && t.status !== 'completed';
  return `<div class="task-card">
    <div class="task-card__header">
      <span class="badge" style="background:${p.bg};color:${p.color};font-size:0.6875rem">${p.label}</span>
      ${overdue?`<span class="badge badge-danger" style="font-size:0.6875rem">Overdue</span>`:''}
    </div>
    <div class="task-card__title">${escapeHTML(t.title)}</div>
    <div class="task-card__meta">
      <span>📂 ${escapeHTML(t.dept)}</span>
      ${t.due?`<span>📅 ${formatDate(t.due)}</span>`:''}
    </div>
    ${t.assignee?`<div class="task-card__assignee"><div class="avatar avatar-sm">${t.assignee.split(' ').map(p=>p[0]).join('')}</div><span>${escapeHTML(t.assignee)}</span></div>`:''}
    ${t.tags.length?`<div class="task-card__tags">${t.tags.map(tag=>`<span class="badge badge-neutral" style="font-size:0.6875rem">${escapeHTML(tag)}</span>`).join('')}</div>`:''}
  </div>`;
}

function taskRow(t) {
  const p  = PRIORITIES[t.priority]||PRIORITIES.medium;
  const s  = STATUSES.find(x=>x.id===t.status)||STATUSES[0];
  const overdue = t.due && new Date(t.due)<new Date() && t.status!=='completed';
  return `<tr>
    <td style="font-weight:500;max-width:280px">${escapeHTML(t.title)}
      ${overdue?`<span class="badge badge-danger" style="font-size:0.6875rem;margin-left:6px">Overdue</span>`:''}
    </td>
    <td class="text-secondary">${escapeHTML(t.dept)}</td>
    <td><span class="badge" style="background:${p.bg};color:${p.color}">${p.label}</span></td>
    <td><span class="badge" style="background:${s.bg};color:${s.color}">${s.label}</span></td>
    <td class="text-secondary">${t.assignee||'—'}</td>
    <td class="text-secondary text-sm">${t.due?formatDate(t.due):'—'}</td>
  </tr>`;
}

function filterTasks() {
  return TASKS.filter(t => {
    const q = _state.search.toLowerCase();
    const matchQ  = !q || t.title.toLowerCase().includes(q) || t.dept.toLowerCase().includes(q) || (t.assignee||'').toLowerCase().includes(q);
    const matchSt = _state.filterStatus==='all' || t.status===_state.filterStatus;
    const matchPr = _state.filterPriority==='all' || t.priority===_state.filterPriority;
    return matchQ && matchSt && matchPr;
  });
}

function bindEvents(container) {
  // Search
  let deb;
  container.querySelector('#task-search')?.addEventListener('input', e => {
    clearTimeout(deb); deb=setTimeout(()=>{ _state.search=e.target.value; renderBoard(container); },250);
  });
  container.querySelector('#task-status-filter')?.addEventListener('change', e => { _state.filterStatus=e.target.value; renderBoard(container); });
  container.querySelector('#task-priority-filter')?.addEventListener('change', e => { _state.filterPriority=e.target.value; renderBoard(container); });

  // View toggle
  container.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.view = btn.dataset.view;
      container.querySelectorAll('.view-toggle').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderBoard(container);
    });
  });

  // Modal
  const modal    = container.querySelector('#task-modal');
  const open     = () => modal?.classList.remove('hidden');
  const close    = () => modal?.classList.add('hidden');
  container.querySelector('#new-task-btn')?.addEventListener('click', open);
  container.querySelector('#task-modal-close')?.addEventListener('click', close);
  container.querySelector('#task-modal-cancel')?.addEventListener('click', close);
  modal?.addEventListener('click', e => { if(e.target===modal) close(); });

  container.querySelector('#task-modal-save')?.addEventListener('click', () => {
    const title = container.querySelector('#t-title')?.value.trim();
    if (!title) { showToast('Task title is required.','warning'); return; }
    TASKS.unshift({
      id: 't'+Date.now(),
      title,
      dept:     container.querySelector('#t-dept')?.value||'Operations',
      priority: container.querySelector('#t-priority')?.value||'medium',
      status:   'referred',
      assignee: container.querySelector('#t-assignee')?.value.trim()||'',
      due:      container.querySelector('#t-due')?.value||'',
      tags:     [],
      notes:    container.querySelector('#t-notes')?.value.trim()||'',
    });
    close();
    renderBoard(container);
    showToast('Task created successfully.','success');
  });
}
