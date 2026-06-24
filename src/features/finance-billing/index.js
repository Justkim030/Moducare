/**
 * ModuCare MS â€” Finance & Billing Module
 * Overhauled Layout: Modern structural grids, high-density telemetry data cards,
 * side-by-side workspace split panels, and contextual grid states.
 */
import { showToast, formatDate, formatCurrency, hoursToBillingUnits } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; 
  l.href = 'features/finance-billing/finance-billing.css';
  document.head.appendChild(l); 
  _cssLoaded = true;
}

// â”€â”€ Mock Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RATES = {
  'Direct Service':      { rate: 75.00, unit: '15-min' },
  'Group Service':       { rate: 45.00, unit: '15-min' },
  'Administrative':      { rate: 35.00, unit: 'hour'   },
  'Travel':              { rate: 25.00, unit: 'hour'   },
  'Training':            { rate: 30.00, unit: 'hour'   },
  'Documentation':       { rate: 40.00, unit: '15-min' },
};

window.__TIMESHEETS_DATA = [];

async function loadTimesheets() {
  try {
    const res = await fetch('/api/finance');
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data?.error || 'Failed');
    window.__TIMESHEETS_DATA = (data.records || []).map(r => {
      const rateInfo = RATES[r.type] || RATES['Administrative'];
      const hours = rateInfo.unit === '15-min'
        ? hoursToBillingUnits(r.amount)
        : (r.amount / rateInfo.rate);
      return {
        id: r.id,
        staff: r.staff || 'Unassigned',
        date: r.date,
        type: r.type,
        hours: hours,
        notes: r.reference || '',
        approved: r.status === 'paid'
      };
    });
  } catch (e) {
    showToast('Failed to load finance records', 'error');
  }
}

let _tab = 'entry'; // 'entry' | 'log' | 'rates'
let _form = { staff:'', date: new Date().toISOString().split('T')[0], type:'Direct Service', hours:'', notes:'' };

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  switchTab(container, _tab);
}

export async function init(container, State) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  await loadTimesheets();
  switchTab(container, _tab);
  return {
    destroy() {
      console.log('[Finance Module] Dismounting modular layout lifecycle.');
    }
  };
}

function buildShell() {
  return `
  <div class="finance-layout-container">
    <div class="finance-header-bar">
      <div>
        <h1>Finance &amp; Ledger Operations</h1>
        <p>Manage service delivery billing codes, track system wide entry timesheets, and execute financial summaries.</p>
      </div>
      <div>
        <button class="mc-btn btn-primary" id="export-billing-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Ledger (CSV)
        </button>
      </div>
    </div>

    <div id="billing-stats"></div>

    <div class="finance-tabs">
      <button class="mc-tab-trigger ${_tab==='entry'?'active':''}" data-tab="entry">â±ï¸ Timesheet Engine</button>
      <button class="mc-tab-trigger ${_tab==='log'?'active':''}"   data-tab="log">ðŸ“‹ Audit Logs &amp; Ledgers</button>
      <button class="mc-tab-trigger ${_tab==='rates'?'active':''}" data-tab="rates">ðŸ’² Rate Management Schedule</button>
    </div>

    <div id="billing-tab-content" class="finance-tab-content"></div>
  </div>`;
}

function switchTab(container, tab) {
  _tab = tab;
  container.querySelectorAll('.mc-tab-trigger').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));

  renderStats(container);

  const content = container.querySelector('#billing-tab-content');
  if (!content) return;

  if (tab==='entry')  renderEntry(content, container);
  if (tab==='log')    renderLog(content);
  if (tab==='rates')  renderRates(content);
}

function renderStats(container) {
  const el = container.querySelector('#billing-stats');
  if (!el) return;
  const approved  = __TIMESHEETS_DATA.filter(t=>t.approved);
  const pending   = __TIMESHEETS_DATA.filter(t=>!t.approved);
  const totalHrs  = __TIMESHEETS_DATA.reduce((a,t)=>a+t.hours,0);
  const billable  = approved.reduce((a,t)=>a+calcAmount(t),0);

  el.innerHTML = `
  <div class="finance-stats-grid">
    <div class="finance-stat-card">
      <div class="finance-stat-label">Total Hours Tracked</div>
      <div class="finance-stat-value">${totalHrs.toFixed(1)} <span class="finance-stat-value" style="font-size:14px; font-weight:400; color: var(--text-tertiary);">hrs</span></div>
    </div>
    <div class="finance-stat-card">
      <div class="finance-stat-label">Approved Submissions</div>
      <div class="finance-stat-value" style="color:#10b981;">${approved.length} <span style="font-size:14px; font-weight:400; color:rgba(16,185,129,0.7);">items</span></div>
    </div>
    <div class="finance-stat-card">
      <div class="finance-stat-label">Awaiting Clearance</div>
      <div class="finance-stat-value" style="color:#f59e0b;">${pending.length} <span style="font-size:14px; font-weight:400; color:rgba(245,158,11,0.7);">pending</span></div>
    </div>
    <div class="finance-stat-card">
      <div class="finance-stat-label">Billable Capital Revenue</div>
      <div class="finance-stat-value">${formatCurrency(billable)}</div>
    </div>
  </div>`;
}

function renderEntry(content, container) {
  const rateInfo = RATES[_form.type];
  const preview  = calcPreview(_form.hours, _form.type);

  content.innerHTML = `
  <div class="finance-entry-layout">

    <div class="finance-entry-panel">
      <h3>Create Ledger Entry Ticket</h3>

      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div class="finance-form-row">
          <div class="input-group">
            <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Staff Member Profile Name *</label>
            <input type="text" id="ts-staff" class="input" placeholder="e.g. Sara Okonkwo" value="${_form.staff}" />
          </div>
          <div class="input-group">
            <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Service Processing Date *</label>
            <input type="date" id="ts-date" class="input" value="${_form.date}" />
          </div>
        </div>

        <div class="input-group">
          <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Assigned Activity Type Mapping Code *</label>
          <select id="ts-type" class="input">
            ${Object.keys(RATES).map(k=>`<option value="${k}" ${_form.type===k?'selected':''}>${k}</option>`).join('')}
          </select>
          <div class="finance-hint">Baseline Unit Metrics: ${formatCurrency(rateInfo.rate)} per ${rateInfo.unit}</div>
        </div>

        <div class="input-group">
          <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Duration of Activity Hours *</label>
          <input type="number" id="ts-hours" class="input" placeholder="0.00" step="0.25" min="0" value="${_form.hours}" />
          <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">Supports decimal formatting constraints (0.25 equivalent to 15-minute standard block).</div>
        </div>

        <div class="input-group">
          <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Notes / Service Description Statement</label>
          <textarea id="ts-notes" class="input" rows="3" placeholder="Provide detailed audit summaries here..." style="resize: vertical;">${_form.notes}</textarea>
        </div>

        <div id="billing-preview" class="finance-preview">
          ${preview}
        </div>

        <div class="finance-actions">
          <button class="mc-btn-secondary" id="clear-entry-btn">Reset Canvas</button>
          <button class="mc-btn btn-primary" id="submit-entry-btn">Commit Entry Transaction</button>
        </div>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="finance-recent-card">
        <h4>Real-Time Submission Queue</h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${__TIMESHEETS_DATA.slice(0, 5).map(t => `
            <div class="finance-recent-entry">
              <div class="finance-recent-top">
                <span class="finance-recent-type">${t.type}</span>
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 600; ${t.approved ? 'background: rgba(16,185,129,0.1); color:#10b981;' : 'background: rgba(245,158,11,0.1); color:#f59e0b;'}">
                  ${t.approved ? 'Cleared' : 'Pending'}
                </span>
              </div>
              <div class="finance-recent-staff">${t.staff} &bull; ${formatDate(t.date)}</div>
              <div class="finance-recent-amounts">
                <span>${t.hours.toFixed(2)} hrs</span>
                <span>${formatCurrency(calcAmount(t))}</span>
              </div>
            </div>`).join('')}
        </div>
        <button class="mc-btn-link" id="view-log-btn" style="background: none; border: none; color: var(--clr-accent-500); font-size: 12.5px; cursor: pointer; margin-top: 14px; font-weight: 500; padding: 0; text-align: left;">Open Comprehensive Auditing Log &rarr;</button>
      </div>
    </div>

  </div>`;

  bindEntryEvents(content, container);
}

function calcPreview(hours, type) {
  const h = parseFloat(hours)||0;
  const rateInfo = RATES[type]||RATES['Direct Service'];
  if (!h) return `<div class="finance-preview" style="text-align: center; color: var(--text-tertiary); font-size: 12.5px; padding: 10px 0;">Calculated ledger metrics paint dynamically based on duration inputs.</div>`;
  const units  = rateInfo.unit==='15-min' ? hoursToBillingUnits(h) : h;
  const amount = rateInfo.unit==='15-min' ? units * rateInfo.rate : h * rateInfo.rate;
  return `
    <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em;">Transaction Formula Preview</div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr) 1.2fr; gap: 12px; align-items: center;">
      <div><span style="display:block; font-size:10px; color:var(--text-tertiary);">Duration</span><strong style="color:#fff; font-size:13px; font-family:monospace;">${h.toFixed(2)} hrs</strong></div>
      <div><span style="display:block; font-size:10px; color:var(--text-tertiary);">${rateInfo.unit==='15-min'?'Units (15m)':'Hours'}</span><strong style="color:#fff; font-size:13px; font-family:monospace;">${units}</strong></div>
      <div><span style="display:block; font-size:10px; color:var(--text-tertiary);">Rate Class</span><strong style="color:#fff; font-size:13px; font-family:monospace;">${formatCurrency(rateInfo.rate)}</strong></div>
      <div style="text-align: right; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 12px;"><span style="display:block; font-size:10px; color:var(--text-tertiary);">Gross Extension</span><strong style="color:#fff; font-size:16px; font-family:monospace; color: var(--clr-accent-500);">${formatCurrency(amount)}</strong></div>
    </div>`;
}

function calcAmount(entry) {
  const r = RATES[entry.type]||RATES['Administrative'];
  return r.unit==='15-min' ? hoursToBillingUnits(entry.hours) * r.rate : entry.hours * r.rate;
}

function bindEntryEvents(content, container) {
  const updatePreview = () => {
    const h    = content.querySelector('#ts-hours')?.value;
    const type = content.querySelector('#ts-type')?.value;
    const prev = content.querySelector('#billing-preview');
    if (prev) prev.innerHTML = calcPreview(h, type);
  };
  content.querySelector('#ts-hours')?.addEventListener('input', updatePreview);
  content.querySelector('#ts-type')?.addEventListener('change', updatePreview);

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
      showToast('Please specify valid staff identity profiles and execution bounds.','warning'); 
      return;
    }
    __TIMESHEETS_DATA.unshift({
      id:'ts'+Date.now(), staff, date, type, hours, 
      notes: content.querySelector('#ts-notes')?.value.trim()||'',
      approved: false,
    });
    _form = { staff:'', date: new Date().toISOString().split('T')[0], type:'Direct Service', hours:'', notes:'' };
    showToast('Timesheet ledger node dispatched into approval cycles.','success');
    switchTab(container, 'log');
  });

  content.querySelector('#view-log-btn')?.addEventListener('click', () => switchTab(container, 'log'));
}

function renderLog(content) {
  content.innerHTML = `
  <div class="finance-log-wrap">
    <div style="overflow-x: auto;">
      <table class="mc-table finance-log-table">
        <thead>
          <tr>
            <th>Staff Resource Profile</th>
            <th>Processing Date</th>
            <th>Activity Code Mapping</th>
            <th style="text-align: right;">Duration</th>
            <th style="text-align: right;">Metric Units</th>
            <th style="text-align: right;">Calculated Amount</th>
            <th style="text-align: center;">Workflow Status</th>
            <th>Audit Description Ledger</th>
          </tr>
        </thead>
        <tbody>
          ${__TIMESHEETS_DATA.map((t, idx) => {
            const r     = RATES[t.type]||RATES['Administrative'];
            const units = r.unit==='15-min'?hoursToBillingUnits(t.hours):t.hours;
            const amt   = calcAmount(t);
            return `
            <tr>
              <td style="font-weight: 600; color: #fff;">${t.staff}</td>
              <td style="color: var(--text-tertiary);">${formatDate(t.date)}</td>
              <td><span style="color: var(--clr-accent-500); font-weight: 500;">${t.type}</span></td>
              <td style="text-align: right; font-family: monospace;">${t.hours.toFixed(2)}</td>
              <td style="text-align: right; font-family: monospace; color: var(--text-secondary);">${units}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 700; color: #fff;">${formatCurrency(amt)}</td>
              <td style="text-align: center;">
                <span class="status-badge ${t.approved ? 'status-approved' : 'status-pending'}">
                  ${t.approved ? 'Approved' : 'Awaiting'}
                </span>
              </td>
              <td style="color: var(--text-tertiary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.notes||''}">
                ${t.notes || '<span style="color: rgba(255,255,255,0.15)">â€”</span>'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderRates(content) {
  content.innerHTML = `
  <div class="finance-rates-wrap">
    <div class="finance-rates-header">
      <h3>Contractual Billing Rate Matrix</h3>
      <p>Corporate fee indices applied globally during transaction compilation stages. Internal system pricing parameters require Administrative Director override privileges to edit.</p>
    </div>

    <div class="finance-rates-grid">
      ${Object.entries(RATES).map(([name, {rate, unit}]) => {
        const annualized = unit === '15-min' ? rate * 4 * 8 * 220 : rate * 8 * 220;
        return `
        <div class="finance-rate-card">
          <div style="position: absolute; right: -10px; bottom: -10px; font-size: 72px; opacity: 0.02; font-weight: 800; pointer-events: none; color: #fff;">$</div>
          <div class="finance-rate-name">${name}</div>
          <div style="display: flex; align-items: baseline; gap: 6px;">
            <span class="finance-rate-value">${formatCurrency(rate)}</span>
            <span style="font-size: 12px; color: var(--text-tertiary);">/ ${unit}</span>
          </div>
          <div class="finance-rate-yield">
            <span>Projected Yield:</span>
            <span style="color: var(--text-secondary); font-weight: 600; font-family: monospace;">${formatCurrency(annualized)}/yr est.</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function bindEvents(container) {
  container.querySelectorAll('.mc-tab-trigger').forEach(btn => {
    btn.addEventListener('click', () => switchTab(container, btn.dataset.tab));
  });
  
  container.querySelector('#export-billing-btn')?.addEventListener('click', () => {
    import('../../../js/utils.js').then(({ exportCSV }) => {
      const rows = [
        ['Staff','Date','Type','Hours','Units','Amount','Status','Notes'],
        ...__TIMESHEETS_DATA.map(t=>{
          const r=RATES[t.type]||RATES['Administrative'];
          return [t.staff,t.date,t.type,t.hours,
            r.unit==='15-min'?hoursToBillingUnits(t.hours):t.hours,
            calcAmount(t).toFixed(2),t.approved?'Approved':'Pending',t.notes];
        })
      ];
      exportCSV(rows,'moducare-billing-log.csv');
      showToast('Billing data export completed successfully.','success');
    });
  });
}



