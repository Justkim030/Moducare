/**
 * ModuCare MS — Finance & Billing Module
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
  render(container);
  return {
    destroy() {
      console.log('[Finance Module] Dismounting modular layout lifecycle.');
    }
  };
}

function buildShell() {
  return `
  <div class="finance-layout-container" style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 20px;">
      <div>
        <h1 style="font-size: 26px; font-weight: 700; margin: 0 0 6px 0; color: #ffffff; letter-spacing: -0.02em;">Finance &amp; Ledger Operations</h1>
        <p style="color: var(--text-tertiary); margin: 0; font-size: 13.5px;">Manage service delivery billing codes, track system wide entry timesheets, and execute financial summaries.</p>
      </div>
      <div>
        <button class="mc-btn" id="export-billing-btn" style="background: var(--clr-accent-500); color: #fff; border: none; padding: 10px 18px; border-radius: var(--border-radius-sm); font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Ledger (CSV)
        </button>
      </div>
    </div>

    <div id="billing-stats"></div>

    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 5px; border-radius: 8px; display: inline-flex; width: fit-content; gap: 4px;">
      <button class="mc-tab-trigger ${_tab==='entry'?'active':''}" data-tab="entry">⏱️ Timesheet Engine</button>
      <button class="mc-tab-trigger ${_tab==='log'?'active':''}"   data-tab="log">📋 Audit Logs &amp; Ledgers</button>
      <button class="mc-tab-trigger ${_tab==='rates'?'active':''}" data-tab="rates">💲 Rate Management Schedule</button>
    </div>

    <div id="billing-tab-content" style="min-height: 400px;"></div>
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
  const approved  = TIMESHEETS.filter(t=>t.approved);
  const pending   = TIMESHEETS.filter(t=>!t.approved);
  const totalHrs  = TIMESHEETS.reduce((a,t)=>a+t.hours,0);
  const billable  = approved.reduce((a,t)=>a+calcAmount(t),0);
  
  el.innerHTML = `
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <div style="color: var(--text-tertiary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Total Hours Tracked</div>
      <div style="font-size: 28px; font-weight: 700; color: #fff; font-family: monospace;">${totalHrs.toFixed(1)} <span style="font-size: 14px; color: var(--text-tertiary); font-weight: 400;">hrs</span></div>
    </div>
    <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.15); padding: 20px; border-radius: 8px;">
      <div style="color: #10b981; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Approved Submissions</div>
      <div style="font-size: 28px; font-weight: 700; color: #10b981;">${approved.length} <span style="font-size: 14px; font-weight: 400; color: rgba(16,185,129,0.7);">items</span></div>
    </div>
    <div style="background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.15); padding: 20px; border-radius: 8px;">
      <div style="color: #f59e0b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Awaiting Clearance</div>
      <div style="font-size: 28px; font-weight: 700; color: #f59e0b;">${pending.length} <span style="font-size: 14px; font-weight: 400; color: rgba(245,158,11,0.7);">pending</span></div>
    </div>
    <div style="background: rgba(139, 92, 246, 0.04); border: 1px solid rgba(139, 92, 246, 0.2); padding: 20px; border-radius: 8px;">
      <div style="color: #a78bfa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Billable Capital Revenue</div>
      <div style="font-size: 28px; font-weight: 700; color: #fff; font-family: monospace;">${formatCurrency(billable)}</div>
    </div>
  </div>`;
}

function renderEntry(content, container) {
  const rateInfo = RATES[_form.type];
  const preview  = calcPreview(_form.hours, _form.type);

  content.innerHTML = `
  <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: start;">
    
    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 24px; border-radius: 8px;">
      <h3 style="font-size: 16px; font-weight: 600; color: #fff; margin: 0 0 20px 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">Create Ledger Entry Ticket</h3>
      
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="input-group">
            <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Staff Member Profile Name *</label>
            <input type="text" id="ts-staff" class="input" placeholder="e.g. Sara Okonkwo" value="${_form.staff}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff;" />
          </div>
          <div class="input-group">
            <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Service Processing Date *</label>
            <input type="date" id="ts-date" class="input" value="${_form.date}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff;" />
          </div>
        </div>

        <div class="input-group">
          <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Assigned Activity Type Mapping Code *</label>
          <select id="ts-type" class="input" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff;">
            ${Object.keys(RATES).map(k=>`<option value="${k}" ${_form.type===k?'selected':''}>${k}</option>`).join('')}
          </select>
          <div style="font-size: 11.5px; color: var(--clr-accent-500); margin-top: 4px; font-weight: 500;">Baseline Unit Metrics: ${formatCurrency(rateInfo.rate)} per ${rateInfo.unit}</div>
        </div>

        <div class="input-group">
          <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Duration of Activity Hours *</label>
          <input type="number" id="ts-hours" class="input" placeholder="0.00" step="0.25" min="0" value="${_form.hours}" style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff;" />
          <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">Supports decimal formatting constraints (0.25 equivalent to 15-minute standard block).</div>
        </div>

        <div class="input-group">
          <label class="input-label" style="color: var(--text-secondary); margin-bottom: 6px;">Notes / Service Description Statement</label>
          <textarea id="ts-notes" class="input" rows="3" placeholder="Provide detailed audit summaries here..." style="width:100%; padding:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; resize: vertical;">${_form.notes}</textarea>
        </div>

        <div id="billing-preview" style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.08);">
          ${preview}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
          <button class="mc-btn-secondary" id="clear-entry-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 10px 20px; border-radius: 6px; cursor: pointer;">Reset Canvas</button>
          <button class="mc-btn" id="submit-entry-btn" style="background: var(--clr-accent-500); border: none; color: #fff; padding: 10px 22px; border-radius: 6px; font-weight: 600; cursor: pointer;">Commit Entry Transaction</button>
        </div>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 8px;">
        <h4 style="font-size: 14px; font-weight: 600; color: #fff; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-secondary);">Real-Time Submission Queue</h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${TIMESHEETS.slice(0, 5).map(t => `
            <div style="background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.04); padding: 12px 14px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--clr-accent-500); font-size: 13px;">${t.type}</span>
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 600; ${t.approved ? 'background: rgba(16,185,129,0.1); color:#10b981;' : 'background: rgba(245,158,11,0.1); color:#f59e0b;'}">
                  ${t.approved ? 'Cleared' : 'Pending'}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-tertiary);">${t.staff} &bull; ${formatDate(t.date)}</div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 6px; margin-top: 2px; font-family: monospace;">
                <span style="color: var(--text-secondary); font-size: 12px;">${t.hours.toFixed(2)} hrs</span>
                <span style="font-weight: 700; color: #ffffff;">${formatCurrency(calcAmount(t))}</span>
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
  if (!h) return `<div style="text-align: center; color: var(--text-tertiary); font-size: 12.5px; padding: 10px 0;">Calculated ledger metrics paint dynamically based on duration inputs.</div>`;
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
    TIMESHEETS.unshift({
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
  <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">
    <div style="overflow-x: auto;">
      <table class="mc-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06);">
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600;">Staff Resource Profile</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600;">Processing Date</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600;">Activity Code Mapping</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600; text-align: right;">Duration</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600; text-align: right;">Metric Units</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600; text-align: right;">Calculated Amount</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600; text-align: center;">Workflow Status</th>
            <th style="padding: 14px 16px; color: var(--text-secondary); font-weight: 600;">Audit Description Ledger</th>
          </tr>
        </thead>
        <tbody>
          ${TIMESHEETS.map((t, idx) => {
            const r     = RATES[t.type]||RATES['Administrative'];
            const units = r.unit==='15-min'?hoursToBillingUnits(t.hours):t.hours;
            const amt   = calcAmount(t);
            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'};">
              <td style="padding: 14px 16px; font-weight: 600; color: #fff;">${t.staff}</td>
              <td style="padding: 14px 16px; color: var(--text-tertiary);">${formatDate(t.date)}</td>
              <td style="padding: 14px 16px;"><span style="color: var(--clr-accent-500); font-weight: 500;">${t.type}</span></td>
              <td style="padding: 14px 16px; text-align: right; font-family: monospace;">${t.hours.toFixed(2)}</td>
              <td style="padding: 14px 16px; text-align: right; font-family: monospace; color: var(--text-secondary);">${units}</td>
              <td style="padding: 14px 16px; text-align: right; font-family: monospace; font-weight: 700; color: #fff;">${formatCurrency(amt)}</td>
              <td style="padding: 14px 16px; text-align: center;">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; ${t.approved ? 'background: rgba(16,185,129,0.1); color:#10b981;' : 'background: rgba(245,158,11,0.1); color:#f59e0b;'}">
                  ${t.approved ? 'Approved' : 'Awaiting'}
                </span>
              </td>
              <td style="padding: 14px 16px; color: var(--text-tertiary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.notes||''}">
                ${t.notes || '<span style="color: rgba(255,255,255,0.15)">—</span>'}
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
  <div style="display: flex; flex-direction: column; gap: 20px;">
    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 8px;">
      <h3 style="font-size: 15px; font-weight: 600; color: #fff; margin: 0 0 6px 0;">Contractual Billing Rate Matrix</h3>
      <p style="color: var(--text-tertiary); margin: 0; font-size: 13px;">Corporate fee indices applied globally during transaction compilation stages. Internal system pricing parameters require Administrative Director override privileges to edit.</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      ${Object.entries(RATES).map(([name, {rate, unit}]) => {
        const annualized = unit === '15-min' ? rate * 4 * 8 * 220 : rate * 8 * 220;
        return `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 12px; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; bottom: -10px; font-size: 72px; opacity: 0.02; font-weight: 800; pointer-events: none; color: #fff;">$</div>
          <div style="font-weight: 600; font-size: 14px; color: #ffffff;">${name}</div>
          <div style="display: flex; align-items: baseline; gap: 6px;">
            <span style="font-size: 24px; font-weight: 700; color: var(--clr-accent-500); font-family: monospace;">${formatCurrency(rate)}</span>
            <span style="font-size: 12px; color: var(--text-tertiary);">/ ${unit}</span>
          </div>
          <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-tertiary);">
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
        ...TIMESHEETS.map(t=>{
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