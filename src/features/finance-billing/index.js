/**
 * ModuCare MS — Finance & Billing Module
 * Features: Timesheet entry form, billing summary table,
 *           auto-calculation of 15-min units, rate management panel
 */
import { showToast, formatDate, formatCurrency, hoursToBillingUnits } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel='stylesheet'; l.href='/src/features/finance-billing/styles.css';
  document.head.appendChild(l); _cssLoaded = true;
}

// ── Mock Data ────────────────────────────────────────────────
const RATES = {
  'Direct Service':      { rate: 75.00, unit: '15-min' },
  'Group Service':       { rate: 45.00, unit: '15-min' },
  'Administrative':      { rate: 35.00, unit: 'hour'   },
  'Travel':              { rate: 25.00, unit: 'hour'   },
  'Training':            { rate: 30.00, unit: 'hour'   },
  'Documentation':       { rate: 40.00, unit: '15-min' },
};

let TIMESHEETS = [
  { id:'ts001', staff:'Sara Okonkwo',   date:'2025-01-08', type:'Direct Service', hours:6.5,  notes:'Client session — Plan A',    approved:true  },
  { id:'ts002', staff:'Marcus Rivera',  date:'2025-01-08', type:'Administrative', hours:2.0,  notes:'Team coordination meeting',  approved:true  },
  { id:'ts003', staff:'Sara Okonkwo',   date:'2025-01-09', type:'Travel',         hours:1.5,  notes:'Site visit travel',          approved:false },
  { id:'ts004', staff:'Derek Walsh',    date:'2025-01-09', type:'Direct Service', hours:4.0,  notes:'Home visit — Client B',      approved:true  },
  { id:'ts005', staff:'Amara Nwosu',    date:'2025-01-10', type:'Training',       hours:8.0,  notes:'Annual compliance training', approved:false },
  { id:'ts006', staff:'Alex Liu',       date:'2025-01-10', type:'Administrative', hours:3.0,  notes:'Recruitment screening',      approved:true  },
  { id:'ts007', staff:'Sara Okonkwo',   date:'2025-01-13', type:'Documentation',  hours:1.25, notes:'Progress notes update',      approved:true  },
  { id:'ts008', staff:'Marcus Rivera',  date:'2025-01-13', type:'Direct Service', hours:5.5,  notes:'Group session #14',          approved:false },
];

// Current tab
let _tab = 'entry'; // 'entry' | 'log' | 'rates'

// Live form state
let _form = { staff:'', date: new Date().toISOString().split('T')[0], type:'Direct Service', hours:'', notes:'' };

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  switchTab(container, _tab);
}

const ALLOWED_ROLES = ['admin','finance','staff'];

export async function init(mount, State){
  const user = State.getUser();
  if (!user){
    mount.innerHTML = `<section aria-labelledby="forbidden-finance"><h2 id="forbidden-finance">403 — Forbidden</h2><p>Finance area requires appropriate permissions.</p></section>`;
    return { destroy(){} };
  }
  // compatibility wrapper for router
  render(mount);
  return { destroy(){ /* finance module teardown if needed */ } };
}

function buildShell() {
  return `
  <div class="section-header">
    <div>
      <div class="section-title">Finance &amp; Billing</div>
      <div class="section-subtitle">Record staff hours, manage billing rates, and review payroll summaries.</div>
    </div>
    <div class="flex gap-3">
      <button class="btn btn-secondary" id="export-billing-btn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export CSV
      </button>
    </div>
  </div>

  <!-- Billing summary stats -->
  <div id="billing-stats"></div>

  <!-- Tabs -->
  <div class="tabs" id="billing-tabs">
    <button class="tab-btn ${_tab==='entry'?'active':''}" data-tab="entry">⏱ Timesheet Entry</button>
    <button class="tab-btn ${_tab==='log'?'active':''}"   data-tab="log">📋 Billing Log</button>
    <button class="tab-btn ${_tab==='rates'?'active':''}" data-tab="rates">💲 Rate Management</button>
  </div>

  <!-- Tab Content -->
  <div id="billing-tab-content"></div>`;
}

function switchTab(container, tab) {
  _tab = tab;
  container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));

  // Stats (always visible)
  renderStats(container);

  const content = container.querySelector('#billing-tab-content');
  if (!content) return;

  if (tab==='entry')  renderEntry(content, container);
  if (tab==='log')    renderLog(content);
  if (tab==='rates')  renderRates(content);
}

// ── Stats Bar ─────────────────────────────────────────────────
function renderStats(container) {
  const el = container.querySelector('#billing-stats');
  if (!el) return;
  const approved  = TIMESHEETS.filter(t=>t.approved);
  const pending   = TIMESHEETS.filter(t=>!t.approved);
  const totalHrs  = TIMESHEETS.reduce((a,t)=>a+t.hours,0);
  const billable  = approved.reduce((a,t)=>a+calcAmount(t),0);
  el.innerHTML = `<div class="billing-stats-row">
    <div class="billing-stat">
      <span class="billing-stat__val">${totalHrs.toFixed(1)}</span>
      <span class="billing-stat__lbl">Total Hours Logged</span>
    </div>
    <div class="billing-stat">
      <span class="billing-stat__val" style="color:var(--clr-success)">${approved.length}</span>
      <span class="billing-stat__lbl">Approved Entries</span>
    </div>
    <div class="billing-stat">
      <span class="billing-stat__val" style="color:var(--clr-warning)">${pending.length}</span>
      <span class="billing-stat__lbl">Pending Approval</span>
    </div>
    <div class="billing-stat">
      <span class="billing-stat__val" style="color:var(--clr-primary-500)">${formatCurrency(billable)}</span>
      <span class="billing-stat__lbl">Total Billable (Approved)</span>
    </div>
  </div>`;
}

// ── Timesheet Entry Tab ───────────────────────────────────────
function renderEntry(content, container) {
  const rateInfo = RATES[_form.type];
  const preview  = calcPreview(_form.hours, _form.type);

  content.innerHTML = `
  <div class="billing-entry-layout">
    <!-- Entry Form -->
    <div class="card">
      <div class="section-title" style="margin-bottom:var(--sp-5)">New Timesheet Entry</div>
      <div style="display:flex;flex-direction:column;gap:var(--sp-5)">
        <div class="form-row">
          <div class="input-group">
            <label class="input-label" for="ts-staff">Staff Member *</label>
            <input type="text" id="ts-staff" class="input" placeholder="Your full name" value="${_form.staff}" />
          </div>
          <div class="input-group">
            <label class="input-label" for="ts-date">Date *</label>
            <input type="date" id="ts-date" class="input" value="${_form.date}" />
          </div>
        </div>
        <div class="input-group">
          <label class="input-label" for="ts-type">Activity Type *</label>
          <select id="ts-type" class="input filter-select" style="padding:0.5625rem 0.875rem">
            ${Object.keys(RATES).map(k=>`<option value="${k}" ${_form.type===k?'selected':''}>${k}</option>`).join('')}
          </select>
          <span class="input-hint">Rate: ${formatCurrency(rateInfo.rate)} per ${rateInfo.unit}</span>
        </div>
        <div class="input-group">
          <label class="input-label" for="ts-hours">Hours *</label>
          <input type="number" id="ts-hours" class="input" placeholder="e.g. 4.5" step="0.25" min="0" max="24" value="${_form.hours}" />
          <span class="input-hint">Enter decimal hours (0.25 = 15 min, 0.5 = 30 min, etc.)</span>
        </div>
        <div class="input-group">
          <label class="input-label" for="ts-notes">Notes / Service Description</label>
          <textarea id="ts-notes" class="input" rows="3" placeholder="Describe the service or activity performed…" style="resize:vertical">${_form.notes}</textarea>
        </div>

        <!-- Live Preview -->
        <div class="billing-preview" id="billing-preview">
          ${preview}
        </div>

        <div class="form-actions" style="border:none;padding:0">
          <button class="btn btn-secondary" id="clear-entry-btn">Clear</button>
          <button class="btn btn-primary" id="submit-entry-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            Submit Timesheet
          </button>
        </div>
      </div>
    </div>

    <!-- Recent entries sidebar -->
    <div>
      <div class="card">
        <div class="section-title" style="margin-bottom:var(--sp-4);font-size:1rem">My Recent Entries</div>
        ${TIMESHEETS.slice(0,5).map(t=>`
          <div class="recent-entry">
            <div class="recent-entry__top">
              <span class="recent-entry__type">${t.type}</span>
              <span class="badge ${t.approved?'badge-success':'badge-warning'}">${t.approved?'Approved':'Pending'}</span>
            </div>
            <div class="recent-entry__staff">${t.staff} · ${formatDate(t.date)}</div>
            <div class="recent-entry__amounts">
              <span>${t.hours} hrs</span>
              <span>${formatCurrency(calcAmount(t))}</span>
            </div>
          </div>`).join('')}
        <button class="btn btn-ghost btn-sm w-full" style="margin-top:var(--sp-3)" id="view-log-btn">View full billing log →</button>
      </div>
    </div>
  </div>`;

  // Bind entry events
  bindEntryEvents(content, container);
}

function calcPreview(hours, type) {
  const h = parseFloat(hours)||0;
  const rateInfo = RATES[type]||RATES['Direct Service'];
  if (!h) return `<div class="billing-preview__empty">Enter hours above to see billing calculation.</div>`;
  const units  = rateInfo.unit==='15-min' ? hoursToBillingUnits(h) : h;
  const amount = rateInfo.unit==='15-min' ? units * rateInfo.rate : h * rateInfo.rate;
  return `
    <div class="billing-preview__label">Billing Preview</div>
    <div class="billing-preview__grid">
      <div class="bp-item"><span class="bp-item__lbl">Hours Entered</span><span class="bp-item__val">${h.toFixed(2)} hrs</span></div>
      <div class="bp-item"><span class="bp-item__lbl">${rateInfo.unit==='15-min'?'Billing Units (15-min)':'Billing Hours'}</span><span class="bp-item__val">${units}</span></div>
      <div class="bp-item"><span class="bp-item__lbl">Rate</span><span class="bp-item__val">${formatCurrency(rateInfo.rate)} / ${rateInfo.unit}</span></div>
      <div class="bp-item bp-item--total"><span class="bp-item__lbl">Total Amount</span><span class="bp-item__val" style="color:var(--clr-primary-500);font-size:1.25rem">${formatCurrency(amount)}</span></div>
    </div>`;
}

function calcAmount(entry) {
  const r = RATES[entry.type]||RATES['Administrative'];
  return r.unit==='15-min'
    ? hoursToBillingUnits(entry.hours) * r.rate
    : entry.hours * r.rate;
}

function bindEntryEvents(content, container) {
  const updatePreview = () => {
    const h    = content.querySelector('#ts-hours')?.value;
    const type = content.querySelector('#ts-type')?.value;
    const prev = content.querySelector('#billing-preview');
    if (prev) prev.innerHTML = calcPreview(h, type);
    // sync hint
    const hint = content.querySelector('.input-hint');
    if (hint && type) {
      const r = RATES[type];
      hint.textContent = `Rate: ${formatCurrency(r.rate)} per ${r.unit}`;
    }
  };
  content.querySelector('#ts-hours')?.addEventListener('input', updatePreview);
  content.querySelector('#ts-type')?.addEventListener('change', updatePreview);

  // Live form sync
  ['ts-staff','ts-date','ts-hours','ts-notes','ts-type'].forEach(id => {
    content.querySelector(`#${id}`)?.addEventListener('input', e => {
      const key = id.replace('ts-','');
      _form[key==='type'?'type':key] = e.target.value;
    });
  });

  content.querySelector('#clear-entry-btn')?.addEventListener('click', () => {
    _form = { staff:'', date: new Date().toISOString().split('T')[0], type:'Direct Service', hours:'', notes:'' };
    switchTab(container, 'entry');
  });

  content.querySelector('#submit-entry-btn')?.addEventListener('click', () => {
    const staff = content.querySelector('#ts-staff')?.value.trim();
    const hours = parseFloat(content.querySelector('#ts-hours')?.value);
    const type  = content.querySelector('#ts-type')?.value;
    const date  = content.querySelector('#ts-date')?.value;
    if (!staff||!hours||isNaN(hours)||hours<=0) {
      showToast('Please fill in staff name and valid hours.','warning'); return;
    }
    TIMESHEETS.unshift({
      id:'ts'+Date.now(), staff, date, type,
      hours, notes: content.querySelector('#ts-notes')?.value.trim()||'',
      approved: false,
    });
    _form = { staff:'', date: new Date().toISOString().split('T')[0], type:'Direct Service', hours:'', notes:'' };
    showToast('Timesheet submitted for approval.','success');
    switchTab(container, 'log');
  });

  content.querySelector('#view-log-btn')?.addEventListener('click', () => switchTab(container, 'log'));
}

// ── Billing Log Tab ───────────────────────────────────────────
function renderLog(content) {
  content.innerHTML = `
  <div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th>Staff Member</th><th>Date</th><th>Activity Type</th>
        <th>Hours</th><th>Units</th><th>Amount</th><th>Status</th><th>Notes</th>
      </tr></thead>
      <tbody>
        ${TIMESHEETS.map(t => {
          const r     = RATES[t.type]||RATES['Administrative'];
          const units = r.unit==='15-min'?hoursToBillingUnits(t.hours):t.hours;
          const amt   = calcAmount(t);
          return `<tr>
            <td style="font-weight:500">${t.staff}</td>
            <td class="text-secondary">${formatDate(t.date)}</td>
            <td><span class="badge badge-primary">${t.type}</span></td>
            <td class="font-mono">${t.hours.toFixed(2)}</td>
            <td class="font-mono">${units}</td>
            <td style="font-weight:700;color:var(--clr-primary-500)">${formatCurrency(amt)}</td>
            <td><span class="badge ${t.approved?'badge-success':'badge-warning'}">${t.approved?'Approved':'Pending'}</span></td>
            <td class="text-secondary text-sm" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes||'—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── Rate Management Tab ───────────────────────────────────────
function renderRates(content) {
  content.innerHTML = `
  <div class="card" style="max-width:680px">
    <div class="section-title" style="margin-bottom:var(--sp-4)">Billing Rate Schedule</div>
    <p class="text-secondary" style="margin-bottom:var(--sp-5);font-size:0.875rem">
      Rates are applied automatically when calculating timesheet billing amounts.
      Contact a Finance Director to request rate changes.
    </p>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Activity Type</th><th>Rate</th><th>Unit</th><th>Annual Equiv.</th></tr></thead>
        <tbody>
          ${Object.entries(RATES).map(([name,{rate,unit}])=>`<tr>
            <td style="font-weight:600">${name}</td>
            <td style="color:var(--clr-primary-500);font-weight:700">${formatCurrency(rate)}</td>
            <td><span class="badge badge-neutral">${unit}</span></td>
            <td class="text-secondary">${unit==='15-min'?formatCurrency(rate*4*8*220)+'/yr est.':formatCurrency(rate*8*220)+'/yr est.'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="alert alert--info" style="margin-top:var(--sp-5)">
      <span class="alert__icon">ℹ️</span>
      <div>
        <div class="alert__title">Rate Effective Date</div>
        Rates shown are effective as of January 1, 2025. Historical rates are archived in the Document Vault.
      </div>
    </div>
  </div>`;
}

function bindEvents(container) {
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(container, btn.dataset.tab));
  });
  container.querySelector('#export-billing-btn')?.addEventListener('click', () => {
    import('../../../js/utils.js').then(({ exportCSV }) => {
      const rows = [
        ['Staff','Date','Type','Hours','Units','Amount','Status','Notes'],
        ...TIMESHEETS.map(t=>{
          const r=RATES[t.type]||RATES['Administrative'];
          return [t.staff,t.date,t.type,t.hours,
            r.unit==='15-min'?hoursToBillingUnits(t.hours):t.hours,
            calcAmount(t).toFixed(2),t.approved?'Approved':'Pending',t.notes];
        })
      ];
      exportCSV(rows,'moducare-billing-log.csv');
      showToast('Billing log exported.','success');
    });
  });
}
