/**
 * ModuCare MS — Human Resources Module
 * Features: Employees, Contracts, Training, Performance, Payroll
 */
import { showToast, formatDate, formatCurrency, escapeHTML, apiFetch, buildPaginationHTML, attachPagination } from '../../../js/utils.js';
import { hasCapability } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/src/features/hr/styles.css';
  document.head.appendChild(link);
  _cssLoaded = true;
}

// ── Module state ──────────────────────────────────────────────
const state = {
  emp:       { page: 1, perPage: 10, totalPages: 1, total: 0 },
  contract:  { page: 1, perPage: 10, totalPages: 1, total: 0 },
  training:  { page: 1, perPage: 10, totalPages: 1, total: 0 },
  perf:      { page: 1, perPage: 10, totalPages: 1, total: 0 },
  payroll:   { page: 1, perPage: 10, totalPages: 1, total: 0 },
};

// Local caches so edit modals can be pre-filled without extra fetches.
let _employees  = [];
let _contracts  = [];
let _trainings  = [];
let _perf       = [];
let _payroll    = [];

let _editingEmpId        = null;
let _editingContractId   = null;
let _editingTrainingId   = null;
let _editingPerfId       = null;
let _editingPayrollId    = null;

const ROLE_LABELS = {
  role_admin:      'System Administrator',
  role_dev:        'Front-Desk / Intake',
  role_nurse:      'Clinical Staff / Triage',
  role_lead:       'Healthcare Provider',
  role_supervisor: 'M&E Officer',
  role_director:   'M&E Director',
  role_finance:    'Ancillary Services',
};

const DEPT_OPTIONS = [
  'Operations', 'Finance & Billing', 'HR', 'Audit & Compliance',
  'Analytics', 'Document Vault', 'System Administration',
];

// ── Init ──────────────────────────────────────────────────────
export async function init(mount, State) {
  injectCSS();
  bindEvents(mount);
  await Promise.all([
    loadEmployees(mount),
    loadContracts(mount),
    loadTraining(mount),
    loadPerformance(mount),
    loadPayroll(mount),
  ]);
  return { destroy() { if (mount) mount.innerHTML = ''; } };
}

// ── Event wiring ──────────────────────────────────────────────
function bindEvents(mount) {
  // Tab switching
  mount.querySelectorAll('.hr-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mount.querySelectorAll('.hr-tab').forEach(t => t.classList.remove('active'));
      mount.querySelectorAll('.hr-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = mount.querySelector('.hr-panel[data-panel="' + tab.dataset.tab + '"]');
      if (panel) panel.classList.add('active');
    });
  });

  // Employee modals
  mount.querySelector('#new-emp-btn').addEventListener('click', () => openEmpModal(mount));
  mount.querySelector('#close-emp-modal').addEventListener('click', () => closeEmpModal(mount));
  mount.querySelector('#cancel-emp').addEventListener('click', () => closeEmpModal(mount));
  mount.querySelector('#emp-form').addEventListener('submit', (e) => { e.preventDefault(); submitEmpForm(mount); });

  // Contract modals
  mount.querySelector('#new-contract-btn').addEventListener('click', () => openContractModal(mount));
  mount.querySelector('#close-contract-modal').addEventListener('click', () => closeContractModal(mount));
  mount.querySelector('#cancel-contract').addEventListener('click', () => closeContractModal(mount));
  mount.querySelector('#contract-form').addEventListener('submit', (e) => { e.preventDefault(); submitContractForm(mount); });

  // Training modals
  mount.querySelector('#new-training-btn').addEventListener('click', () => openTrainingModal(mount));
  mount.querySelector('#close-training-modal').addEventListener('click', () => closeTrainingModal(mount));
  mount.querySelector('#cancel-training').addEventListener('click', () => closeTrainingModal(mount));
  mount.querySelector('#training-form').addEventListener('submit', (e) => { e.preventDefault(); submitTrainingForm(mount); });

  // Performance modals
  mount.querySelector('#new-perf-btn').addEventListener('click', () => openPerfModal(mount));
  mount.querySelector('#close-perf-modal').addEventListener('click', () => closePerfModal(mount));
  mount.querySelector('#cancel-perf').addEventListener('click', () => closePerfModal(mount));
  mount.querySelector('#perf-form').addEventListener('submit', (e) => { e.preventDefault(); submitPerfForm(mount); });

  // Payroll modals
  mount.querySelector('#new-payroll-btn').addEventListener('click', () => openPayrollModal(mount));
  mount.querySelector('#close-payroll-modal').addEventListener('click', () => closePayrollModal(mount));
  mount.querySelector('#cancel-payroll').addEventListener('click', () => closePayrollModal(mount));
  mount.querySelector('#payroll-form').addEventListener('submit', (e) => { e.preventDefault(); submitPayrollForm(mount); });

  // Employee filters
  mount.querySelector('#emp-search').addEventListener('input', debounce(() => { state.emp.page = 1; loadEmployees(mount); }, 300));
  mount.querySelector('#emp-dept-filter').addEventListener('change', () => { state.emp.page = 1; loadEmployees(mount); });
  mount.querySelector('#emp-status-filter').addEventListener('change', () => { state.emp.page = 1; loadEmployees(mount); });

  // Delegated row actions
  mount.querySelector('#emp-table-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') openEmpModal(mount, id);
    else if (btn.dataset.action === 'delete') deleteEmp(mount, id);
    else if (btn.dataset.action === 'view') viewEmp(mount, id);
  });

  mount.querySelector('#contract-table-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') openContractModal(mount, id);
    else if (btn.dataset.action === 'delete') deleteContract(mount, id);
  });

  mount.querySelector('#training-table-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') openTrainingModal(mount, id);
    else if (btn.dataset.action === 'delete') deleteTraining(mount, id);
  });

  mount.querySelector('#perf-table-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') openPerfModal(mount, id);
    else if (btn.dataset.action === 'delete') deletePerf(mount, id);
  });

  mount.querySelector('#payroll-table-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') openPayrollModal(mount, id);
    else if (btn.dataset.action === 'delete') deletePayroll(mount, id);
    else if (btn.dataset.action === 'mark-paid') markPayrollPaid(mount, id);
  });
}

function debounce(fn, ms) {
  let t;
  return function () {
    const ctx = this;
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(ctx, args), ms);
  };
}

// ── Helpers ───────────────────────────────────────────────────
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'paid' || s === 'processed') return '<span class="badge badge-success">' + escapeHTML(status || '—') + '</span>';
  if (s === 'suspended' || s === 'pending' || s === 'submitted' || s === 'draft') return '<span class="badge badge-warning">' + escapeHTML(status || '—') + '</span>';
  if (s === 'inactive' || s === 'terminated' || s === 'rejected' || s === 'cancelled') return '<span class="badge badge-danger">' + escapeHTML(status || '—') + '</span>';
  return '<span class="badge badge-neutral">' + escapeHTML(status || '—') + '</span>';
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—';
}

function empNameById(id) {
  const e = _employees.find(x => String(x.id) === String(id));
  return e ? (e.name || e.email || '—') : '—';
}

function num(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function money(val) {
  const n = num(val);
  return n ? formatCurrency(n) : '—';
}

// ── Employees ─────────────────────────────────────────────────
async function loadEmployees(mount) {
  const wrap = mount.querySelector('#emp-table-wrap');
  const pg = mount.querySelector('#emp-pagination');
  wrap.innerHTML = '<div class="empty-state"><h3>Loading…</h3></div>';

  const search = encodeURIComponent(mount.querySelector('#emp-search').value || '');
  const dept = encodeURIComponent(mount.querySelector('#emp-dept-filter').value || '');
  const estatus = encodeURIComponent(mount.querySelector('#emp-status-filter').value || '');

  let url = '/employees?page=' + state.emp.page + '&limit=' + state.emp.perPage;
  if (search) url += '&search=' + search;
  if (dept) url += '&department=' + dept;
  if (estatus) url += '&status=' + estatus;

  try {
    const data = await apiFetch(url);
    const rows = data.data || [];
    state.emp.total = data.pagination ? data.pagination.total : 0;
    state.emp.totalPages = data.pagination ? data.pagination.totalPages : 1;
    _employees = rows;

    populateDeptFilter(mount);

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><h3>No employees found</h3></div>';
      pg.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <table class="hr-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Position</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="font-weight-500">${escapeHTML(r.name || '—')}</td>
              <td class="text-secondary">${escapeHTML(r.email || '—')}</td>
              <td><span class="badge badge-primary">${escapeHTML(roleLabel(r.role_id || r.role))}</span></td>
              <td>${escapeHTML(r.department || '—')}</td>
              <td>${escapeHTML(r.position || '—')}</td>
              <td>${statusBadge(r.status)}</td>
              <td>
                <button class="mc-btn mc-btn--sm" data-action="view" data-id="${escapeHTML(String(r.id))}">View</button>
                <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(String(r.id))}">Edit</button>
                <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(String(r.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    pg.innerHTML = buildPaginationHTML(state.emp.page, state.emp.perPage, state.emp.total);
    attachPagination(pg, state.emp, () => loadEmployees(mount));
  } catch (err) {
    wrap.innerHTML = '<div class="empty-state"><h3>Failed to load employees</h3></div>';
  }
}

function populateDeptFilter(mount) {
  const sel = mount.querySelector('#emp-dept-filter');
  if (!sel) return;
  const current = sel.value;
  const depts = DEPT_OPTIONS.slice();
  _employees.forEach(e => { if (e.department && depts.indexOf(e.department) === -1) depts.push(e.department); });
  sel.innerHTML = '<option value="">All Departments</option>' +
    depts.map(d => '<option value="' + escapeHTML(d) + '"' + (current === d ? ' selected' : '') + '>' + escapeHTML(d) + '</option>').join('');
}

function viewEmp(mount, id) {
  const emp = _employees.find(e => String(e.id) === String(id));
  if (!emp) return;
  const profile = emp.profile || emp;
  alert(
    'Employee: ' + (emp.name || '—') + '\n' +
    'Email: ' + (emp.email || '—') + '\n' +
    'Role: ' + roleLabel(emp.role_id || emp.role) + '\n' +
    'Position: ' + (profile.position || '—') + '\n' +
    'Department: ' + (emp.department || '—') + '\n' +
    'Status: ' + (profile.status || emp.status || '—') + '\n' +
    'Hire Date: ' + (profile.hire_date || '—') + '\n' +
    'Salary: ' + (profile.salary ? money(profile.salary) : '—')
  );
}

function openEmpModal(mount, id) {
  _editingEmpId = id || null;
  const title = mount.querySelector('#emp-modal-title');
  const form = mount.querySelector('#emp-form');
  form.reset();

  if (id) {
    title.textContent = 'Edit Employee';
    const emp = _employees.find(e => String(e.id) === String(id));
    if (emp) {
      const profile = emp.profile || emp;
      mount.querySelector('#emp-name').value = emp.name || '';
      mount.querySelector('#emp-email').value = emp.email || '';
      mount.querySelector('#emp-phone').value = emp.phone_number || '';
      mount.querySelector('#emp-role').value = emp.role_id || emp.role || 'role_nurse';
      mount.querySelector('#emp-position').value = profile.position || emp.position || '';
      mount.querySelector('#emp-etype').value = profile.employment_type || emp.employment_type || 'full_time';
      mount.querySelector('#emp-hire').value = profile.hire_date || emp.hire_date || '';
      mount.querySelector('#emp-salary').value = profile.salary || emp.salary || '';
      mount.querySelector('#emp-emergency').value = profile.emergency_contact || emp.emergency_contact || '';
    }
  } else {
    title.textContent = 'Add Employee';
  }

  mount.querySelector('#emp-modal').style.display = 'flex';
}

function closeEmpModal(mount) {
  mount.querySelector('#emp-modal').style.display = 'none';
  _editingEmpId = null;
}

async function submitEmpForm(mount) {
  const payload = {
    name: mount.querySelector('#emp-name').value.trim(),
    email: mount.querySelector('#emp-email').value.trim(),
    phone_number: mount.querySelector('#emp-phone').value.trim(),
    role_id: mount.querySelector('#emp-role').value,
    position: mount.querySelector('#emp-position').value.trim(),
    employment_type: mount.querySelector('#emp-etype').value,
    hire_date: mount.querySelector('#emp-hire').value,
    salary: num(mount.querySelector('#emp-salary').value),
    emergency_contact: mount.querySelector('#emp-emergency').value.trim(),
  };

  if (!payload.name || !payload.email) {
    showToast('Name and email are required.', 'warning');
    return;
  }

  try {
    if (_editingEmpId) {
      const data = await apiFetch('/employees/' + _editingEmpId, { method: 'PUT', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Employee updated', 'success');
    } else {
      const data = await apiFetch('/users', { method: 'POST', body: JSON.stringify(Object.assign({}, payload, { password: 'Password1!' })) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Employee created', 'success');
    }
    closeEmpModal(mount);
    loadEmployees(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

async function deleteEmp(mount, id) {
  if (!confirm('Delete this employee?')) return;
  try {
    const data = await apiFetch('/users/' + id, { method: 'DELETE' });
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Employee deleted', 'success');
    loadEmployees(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

// ── Contracts ─────────────────────────────────────────────────
async function loadContracts(mount) {
  const wrap = mount.querySelector('#contract-table-wrap');
  const pg = mount.querySelector('#contract-pagination');
  wrap.innerHTML = '<div class="empty-state"><h3>Loading…</h3></div>';

  try {
    const data = await apiFetch('/contracts?page=' + state.contract.page + '&limit=' + state.contract.perPage);
    const rows = data.data || [];
    state.contract.total = data.pagination ? data.pagination.total : 0;
    state.contract.totalPages = data.pagination ? data.pagination.totalPages : 1;
    _contracts = rows;

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><h3>No contracts found</h3></div>';
      pg.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <table class="hr-table">
        <thead><tr>
          <th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Salary</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map(c => `
            <tr>
              <td class="font-weight-500">${escapeHTML(empNameById(c.employee_id || c.user_id))}</td>
              <td><span class="badge badge-neutral">${escapeHTML(c.contract_type || '—')}</span></td>
              <td>${escapeHTML(formatDate(c.start_date || '—'))}</td>
              <td>${escapeHTML(c.end_date ? formatDate(c.end_date) : '—')}</td>
              <td>${money(c.salary)}</td>
              <td>${statusBadge(c.status)}</td>
              <td>
                <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(String(c.id))}">Edit</button>
                <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(String(c.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    pg.innerHTML = buildPaginationHTML(state.contract.page, state.contract.perPage, state.contract.total);
    attachPagination(pg, state.contract, () => loadContracts(mount));
  } catch (err) {
    wrap.innerHTML = '<div class="empty-state"><h3>Failed to load contracts</h3></div>';
  }
}

function openContractModal(mount, id) {
  _editingContractId = id || null;
  const title = mount.querySelector('#contract-modal-title');
  const form = mount.querySelector('#contract-form');
  form.reset();
  populateEmployeeSelect(mount, '#contract-emp');

  if (id) {
    title.textContent = 'Edit Contract';
    const c = _contracts.find(x => String(x.id) === String(id));
    if (c) {
      mount.querySelector('#contract-emp').value = c.employee_id || c.user_id || '';
      mount.querySelector('#contract-type').value = c.contract_type || 'permanent';
      mount.querySelector('#contract-start').value = c.start_date || '';
      mount.querySelector('#contract-end').value = c.end_date || '';
      mount.querySelector('#contract-salary').value = c.salary || '';
      mount.querySelector('#contract-terms').value = c.terms || '';
    }
  } else {
    title.textContent = 'New Contract';
  }

  mount.querySelector('#contract-modal').style.display = 'flex';
}

function closeContractModal(mount) {
  mount.querySelector('#contract-modal').style.display = 'none';
  _editingContractId = null;
}

async function submitContractForm(mount) {
  const employeeId = mount.querySelector('#contract-emp').value;
  if (!employeeId) { showToast('Please select an employee.', 'warning'); return; }

  const payload = {
    employee_id: employeeId,
    contract_type: mount.querySelector('#contract-type').value,
    start_date: mount.querySelector('#contract-start').value,
    end_date: mount.querySelector('#contract-end').value,
    salary: num(mount.querySelector('#contract-salary').value),
    terms: mount.querySelector('#contract-terms').value.trim(),
  };

  try {
    if (_editingContractId) {
      const data = await apiFetch('/contracts/' + _editingContractId, { method: 'PUT', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Contract updated', 'success');
    } else {
      const data = await apiFetch('/contracts', { method: 'POST', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Contract created', 'success');
    }
    closeContractModal(mount);
    loadContracts(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

async function deleteContract(mount, id) {
  if (!confirm('Delete this contract?')) return;
  try {
    const data = await apiFetch('/contracts/' + id, { method: 'DELETE' });
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Contract deleted', 'success');
    loadContracts(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

// ── Training ──────────────────────────────────────────────────
async function loadTraining(mount) {
  const wrap = mount.querySelector('#training-table-wrap');
  const pg = mount.querySelector('#training-pagination');
  wrap.innerHTML = '<div class="empty-state"><h3>Loading…</h3></div>';

  try {
    const data = await apiFetch('/trainings?page=' + state.training.page + '&limit=' + state.training.perPage);
    const rows = data.data || [];
    state.training.total = data.pagination ? data.pagination.total : 0;
    state.training.totalPages = data.pagination ? data.pagination.totalPages : 1;
    _trainings = rows;

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><h3>No training records found</h3></div>';
      pg.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <table class="hr-table">
        <thead><tr>
          <th>Employee</th><th>Name</th><th>Type</th><th>Provider</th><th>Start</th><th>End</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map(t => `
            <tr>
              <td class="font-weight-500">${escapeHTML(empNameById(t.employee_id || t.user_id))}</td>
              <td>${escapeHTML(t.name || '—')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(t.training_type || '—')}</span></td>
              <td>${escapeHTML(t.provider || '—')}</td>
              <td>${escapeHTML(t.start_date ? formatDate(t.start_date) : '—')}</td>
              <td>${escapeHTML(t.end_date ? formatDate(t.end_date) : '—')}</td>
              <td>
                <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(String(t.id))}">Edit</button>
                <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(String(t.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    pg.innerHTML = buildPaginationHTML(state.training.page, state.training.perPage, state.training.total);
    attachPagination(pg, state.training, () => loadTraining(mount));
  } catch (err) {
    wrap.innerHTML = '<div class="empty-state"><h3>Failed to load training records</h3></div>';
  }
}

function openTrainingModal(mount, id) {
  _editingTrainingId = id || null;
  const title = mount.querySelector('#training-modal-title');
  const form = mount.querySelector('#training-form');
  form.reset();
  populateEmployeeSelect(mount, '#training-emp');

  if (id) {
    title.textContent = 'Edit Training';
    const t = _trainings.find(x => String(x.id) === String(id));
    if (t) {
      mount.querySelector('#training-emp').value = t.employee_id || t.user_id || '';
      mount.querySelector('#training-name').value = t.name || '';
      mount.querySelector('#training-type').value = t.training_type || 'onboarding';
      mount.querySelector('#training-provider').value = t.provider || '';
      mount.querySelector('#training-start').value = t.start_date || '';
      mount.querySelector('#training-end').value = t.end_date || '';
      mount.querySelector('#training-cert').value = t.certificate_url || '';
    }
  } else {
    title.textContent = 'Add Training';
  }

  mount.querySelector('#training-modal').style.display = 'flex';
}

function closeTrainingModal(mount) {
  mount.querySelector('#training-modal').style.display = 'none';
  _editingTrainingId = null;
}

async function submitTrainingForm(mount) {
  const employeeId = mount.querySelector('#training-emp').value;
  const name = mount.querySelector('#training-name').value.trim();
  if (!employeeId || !name) { showToast('Employee and training name are required.', 'warning'); return; }

  const payload = {
    employee_id: employeeId,
    name: name,
    training_type: mount.querySelector('#training-type').value,
    provider: mount.querySelector('#training-provider').value.trim(),
    start_date: mount.querySelector('#training-start').value,
    end_date: mount.querySelector('#training-end').value,
    certificate_url: mount.querySelector('#training-cert').value.trim(),
  };

  try {
    if (_editingTrainingId) {
      const data = await apiFetch('/trainings/' + _editingTrainingId, { method: 'PUT', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Training updated', 'success');
    } else {
      const data = await apiFetch('/trainings', { method: 'POST', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Training created', 'success');
    }
    closeTrainingModal(mount);
    loadTraining(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

async function deleteTraining(mount, id) {
  if (!confirm('Delete this training record?')) return;
  try {
    const data = await apiFetch('/trainings/' + id, { method: 'DELETE' });
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Training deleted', 'success');
    loadTraining(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

// ── Performance ───────────────────────────────────────────────
async function loadPerformance(mount) {
  const wrap = mount.querySelector('#perf-table-wrap');
  const pg = mount.querySelector('#perf-pagination');
  wrap.innerHTML = '<div class="empty-state"><h3>Loading…</h3></div>';

  try {
    const data = await apiFetch('/performance?page=' + state.perf.page + '&limit=' + state.perf.perPage);
    const rows = data.data || [];
    state.perf.total = data.pagination ? data.pagination.total : 0;
    state.perf.totalPages = data.pagination ? data.pagination.totalPages : 1;
    _perf = rows;

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><h3>No performance reviews found</h3></div>';
      pg.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <table class="hr-table">
        <thead><tr>
          <th>Employee</th><th>Period</th><th>Rating</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map(p => `
            <tr>
              <td class="font-weight-500">${escapeHTML(empNameById(p.employee_id || p.user_id))}</td>
              <td>${escapeHTML(p.review_period || '—')}</td>
              <td>${p.rating != null ? escapeHTML(String(p.rating)) : '—'}</td>
              <td>${statusBadge(p.status)}</td>
              <td>
                <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(String(p.id))}">Edit</button>
                <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(String(p.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    pg.innerHTML = buildPaginationHTML(state.perf.page, state.perf.perPage, state.perf.total);
    attachPagination(pg, state.perf, () => loadPerformance(mount));
  } catch (err) {
    wrap.innerHTML = '<div class="empty-state"><h3>Failed to load performance reviews</h3></div>';
  }
}

function openPerfModal(mount, id) {
  _editingPerfId = id || null;
  const title = mount.querySelector('#perf-modal-title');
  const form = mount.querySelector('#perf-form');
  form.reset();
  populateEmployeeSelect(mount, '#perf-emp');

  if (id) {
    title.textContent = 'Edit Review';
    const p = _perf.find(x => String(x.id) === String(id));
    if (p) {
      mount.querySelector('#perf-emp').value = p.employee_id || p.user_id || '';
      mount.querySelector('#perf-period').value = p.review_period || '';
      mount.querySelector('#perf-rating').value = p.rating != null ? p.rating : '';
      mount.querySelector('#perf-goals').value = p.goals || '';
      mount.querySelector('#perf-achievements').value = p.achievements || '';
      mount.querySelector('#perf-status').value = p.status || 'draft';
    }
  } else {
    title.textContent = 'Performance Review';
  }

  mount.querySelector('#perf-modal').style.display = 'flex';
}

function closePerfModal(mount) {
  mount.querySelector('#perf-modal').style.display = 'none';
  _editingPerfId = null;
}

async function submitPerfForm(mount) {
  const employeeId = mount.querySelector('#perf-emp').value;
  const period = mount.querySelector('#perf-period').value.trim();
  if (!employeeId || !period) { showToast('Employee and review period are required.', 'warning'); return; }

  const payload = {
    employee_id: employeeId,
    review_period: period,
    rating: num(mount.querySelector('#perf-rating').value),
    goals: mount.querySelector('#perf-goals').value.trim(),
    achievements: mount.querySelector('#perf-achievements').value.trim(),
    status: mount.querySelector('#perf-status').value,
  };

  try {
    if (_editingPerfId) {
      const data = await apiFetch('/performance/' + _editingPerfId, { method: 'PUT', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Review updated', 'success');
    } else {
      const data = await apiFetch('/performance', { method: 'POST', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Review created', 'success');
    }
    closePerfModal(mount);
    loadPerformance(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

async function deletePerf(mount, id) {
  if (!confirm('Delete this performance review?')) return;
  try {
    const data = await apiFetch('/performance/' + id, { method: 'DELETE' });
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Review deleted', 'success');
    loadPerformance(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

// ── Payroll ──────────────────────────────────────────────────
async function loadPayroll(mount) {
  const wrap = mount.querySelector('#payroll-table-wrap');
  const pg = mount.querySelector('#payroll-pagination');
  wrap.innerHTML = '<div class="empty-state"><h3>Loading…</h3></div>';

  try {
    const data = await apiFetch('/payroll?page=' + state.payroll.page + '&limit=' + state.payroll.perPage);
    const rows = data.data || [];
    state.payroll.total = data.pagination ? data.pagination.total : 0;
    state.payroll.totalPages = data.pagination ? data.pagination.totalPages : 1;
    _payroll = rows;

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state"><h3>No payroll entries found</h3></div>';
      pg.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <table class="hr-table">
        <thead><tr>
          <th>Employee</th><th>Period</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${rows.map(p => {
            const basic = num(p.basic_salary);
            const allow = num(p.allowances);
            const ded = num(p.deductions);
            const net = basic + allow - ded;
            return `
            <tr>
              <td class="font-weight-500">${escapeHTML(empNameById(p.employee_id || p.user_id))}</td>
              <td>${escapeHTML((p.period_start ? formatDate(p.period_start) : '?') + ' → ' + (p.period_end ? formatDate(p.period_end) : '?'))}</td>
              <td>${money(basic)}</td>
              <td>${money(allow)}</td>
              <td>${money(ded)}</td>
              <td class="font-weight-500">${money(net)}</td>
              <td>${statusBadge(p.status)}</td>
              <td>
                <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(String(p.id))}">Edit</button>
                <button class="mc-btn mc-btn--sm btn-primary" data-action="mark-paid" data-id="${escapeHTML(String(p.id))}">Mark Paid</button>
                <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(String(p.id))}">Delete</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    pg.innerHTML = buildPaginationHTML(state.payroll.page, state.payroll.perPage, state.payroll.total);
    attachPagination(pg, state.payroll, () => loadPayroll(mount));
  } catch (err) {
    wrap.innerHTML = '<div class="empty-state"><h3>Failed to load payroll</h3></div>';
  }
}

function openPayrollModal(mount, id) {
  _editingPayrollId = id || null;
  const title = mount.querySelector('#payroll-modal-title');
  const form = mount.querySelector('#payroll-form');
  form.reset();
  populateEmployeeSelect(mount, '#payroll-emp');

  if (id) {
    title.textContent = 'Edit Payroll';
    const p = _payroll.find(x => String(x.id) === String(id));
    if (p) {
      mount.querySelector('#payroll-emp').value = p.employee_id || p.user_id || '';
      mount.querySelector('#payroll-status').value = p.status || 'pending';
      mount.querySelector('#payroll-start').value = p.period_start || '';
      mount.querySelector('#payroll-end').value = p.period_end || '';
      mount.querySelector('#payroll-basic').value = p.basic_salary || '';
      mount.querySelector('#payroll-allowances').value = p.allowances || '';
      mount.querySelector('#payroll-deductions').value = p.deductions || '';
    }
  } else {
    title.textContent = 'Payroll Entry';
  }

  mount.querySelector('#payroll-modal').style.display = 'flex';
}

function closePayrollModal(mount) {
  mount.querySelector('#payroll-modal').style.display = 'none';
  _editingPayrollId = null;
}

async function submitPayrollForm(mount) {
  const employeeId = mount.querySelector('#payroll-emp').value;
  if (!employeeId) { showToast('Please select an employee.', 'warning'); return; }

  const payload = {
    employee_id: employeeId,
    status: mount.querySelector('#payroll-status').value,
    period_start: mount.querySelector('#payroll-start').value,
    period_end: mount.querySelector('#payroll-end').value,
    basic_salary: num(mount.querySelector('#payroll-basic').value),
    allowances: num(mount.querySelector('#payroll-allowances').value),
    deductions: num(mount.querySelector('#payroll-deductions').value),
  };

  try {
    if (_editingPayrollId) {
      const data = await apiFetch('/payroll/' + _editingPayrollId, { method: 'PUT', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Payroll updated', 'success');
    } else {
      const data = await apiFetch('/payroll', { method: 'POST', body: JSON.stringify(payload) });
      if (!data.ok) throw new Error(data.error || 'Failed');
      showToast('Payroll created', 'success');
    }
    closePayrollModal(mount);
    loadPayroll(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

async function deletePayroll(mount, id) {
  if (!confirm('Delete this payroll entry?')) return;
  try {
    const data = await apiFetch('/payroll/' + id, { method: 'DELETE' });
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Payroll deleted', 'success');
    loadPayroll(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

async function markPayrollPaid(mount, id) {
  try {
    const data = await apiFetch('/payroll/' + id + '/pay', { method: 'POST' });
    if (!data.ok) throw new Error(data.error || 'Failed');
    showToast('Payroll marked as paid', 'success');
    loadPayroll(mount);
  } catch (err) {
    showToast(err.message || 'Failed', 'error');
  }
}

// ── Employee select population ────────────────────────────────
async function populateEmployeeSelect(mount, selector) {
  const sel = mount.querySelector(selector);
  if (!sel) return;
  try {
    if (_employees.length === 0) {
      const data = await apiFetch('/employees');
      _employees = data.data || [];
    }
    sel.innerHTML = '<option value="">— Select Employee —</option>' +
      _employees.map(e => '<option value="' + escapeHTML(String(e.id)) + '">' + escapeHTML(e.name || e.email || '—') + '</option>').join('');
  } catch (err) {
    sel.innerHTML = '<option value="">— Select Employee —</option>';
  }
}
