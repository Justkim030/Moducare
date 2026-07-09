/**
 * ModuCare MS — Referrals Module
 * Features: Referral list, create new referral, status tracking
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/src/features/referrals/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export async function init(container) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

function render(container) {
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshList(container);
}

function buildShell() {
  return `
  <div class="refs-layout">
    <div class="refs-header">
      <h1>↪️ Referrals</h1>
      <button class="mc-btn btn-primary" id="new-ref-btn">+ New Referral</button>
    </div>
    <div id="refs-list"></div>

    <div id="ref-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <h2>New Referral</h2>
          <button class="modal-close" id="close-ref-modal">&times;</button>
        </div>
        <form id="ref-form" class="ref-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="ref-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Referred To *</label>
              <input type="text" id="ref-to" class="input" required placeholder="e.g. Dr. Smith / Clinic name">
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Referral Type</label>
              <select id="ref-type" class="input">
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="specialist">Specialist</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Priority</label>
              <select id="ref-priority" class="input">
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Reason / Notes</label>
            <textarea id="ref-notes" class="input" rows="3" placeholder="Clinical reason for referral..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-ref">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Create Referral</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#refs-list');
  if (!list) return;
  try {
    const data = await apiFetch('/referrals');
    const refs = data.referrals || [];
    if (refs.length === 0) {
      list.innerHTML = `<div class="empty-state"><h3>No referrals found</h3><p>Create a referral to get started.</p></div>`;
      return;
    }
    list.innerHTML = `
      <div class="refs-table-wrap">
        <table class="mc-table refs-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Patient</th>
              <th>Referred To</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${refs.map(r => `
              <tr>
                <td>${formatDate(r.created_at || r.date)}</td>
                <td>${escapeHTML(r.patient_name || 'Unknown')}</td>
                <td>${escapeHTML(r.referred_to || '—')}</td>
                <td><span class="badge badge-neutral">${escapeHTML(r.referral_type || '—')}</span></td>
                <td><span class="badge ${r.priority === 'stat' ? 'badge-danger' : r.priority === 'urgent' ? 'badge-warning' : 'badge-neutral'}">${escapeHTML(r.priority || 'routine')}</span></td>
                <td>${escapeHTML(r.status || 'pending')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><h3>Failed to load referrals</h3></div>`;
  }
}

function bindEvents(container) {
  const modal = container.querySelector('#ref-modal');
  const form = container.querySelector('#ref-form');

  container.querySelector('#new-ref-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-ref-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-ref')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#ref-patient')?.value,
      referred_to: container.querySelector('#ref-to')?.value.trim(),
      referral_type: container.querySelector('#ref-type')?.value,
      priority: container.querySelector('#ref-priority')?.value,
      reason: container.querySelector('#ref-notes')?.value.trim(),
    };
    try {
      await apiFetch('/referrals', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Referral created', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to create referral', 'error');
    }
  });
}

async function populatePatients(container) {
  const select = container.querySelector('#ref-patient');
  if (!select) return;
  try {
    const data = await apiFetch('/patients');
    const patients = data.patients || [];
    select.innerHTML = '<option value="">-- Select Patient --</option>' +
      patients.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.email || 'no email')})</option>`).join('');
  } catch {
    showToast('Failed to load patients', 'error');
  }
}
