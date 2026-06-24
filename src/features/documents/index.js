/**
 * ModuCare MS — Documents Module
 * Features: Document vault, upload records, document type filtering
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/documents/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshList(container);
}

export async function init(container, State) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

function buildShell() {
  return `
  <div class="docs-layout">
    <div class="docs-header">
      <h1>📁 Document Vault</h1>
      <button class="mc-btn btn-primary" id="new-doc-btn">+ Upload Document</button>
    </div>
    <div class="docs-filters">
      <select id="doc-filter-type" class="input" style="width:auto;">
        <option value="">All Types</option>
        <option value="lab_result">Lab Result</option>
        <option value="clinical_note">Clinical Note</option>
        <option value="imaging">Imaging</option>
        <option value="prescription">Prescription</option>
        <option value="referral">Referral</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div id="doc-list"></div>

    <div id="doc-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Upload Document</h2>
          <button class="modal-close" id="close-doc-modal">&times;</button>
        </div>
        <form id="doc-form" class="doc-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Patient *</label>
              <select id="doc-patient" class="input" required>
                <option value="">-- Select Patient --</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Document Type</label>
              <select id="doc-type" class="input">
                <option value="lab_result">Lab Result</option>
                <option value="clinical_note">Clinical Note</option>
                <option value="imaging">Imaging</option>
                <option value="prescription">Prescription</option>
                <option value="referral">Referral</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">File Name *</label>
            <input type="text" id="doc-filename" class="input" required placeholder="e.g. lab_result_june.pdf">
          </div>
          <div class="input-group">
            <label class="input-label">File Size (bytes)</label>
            <input type="number" id="doc-filesize" class="input" placeholder="e.g. 245000">
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-doc">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Upload Document</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#doc-list');
  if (!list) return;
  const docType = container.querySelector('#doc-filter-type')?.value || '';
  const qs = docType ? `?doc_type=${encodeURIComponent(docType)}` : '';
  const data = await apiFetch(`/documents${qs}`);
  const docs = data.documents || [];
  if (docs.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>No documents found</h3><p>Upload a document to get started.</p></div>`;
    return;
  }
  list.innerHTML = `
    <div class="docs-table-wrap">
      <table class="mc-table docs-table">
        <thead>
          <tr>
            <th>Uploaded</th>
            <th>Patient</th>
            <th>Type</th>
            <th>File Name</th>
            <th>Size</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          ${docs.map(d => `
            <tr>
              <td>${formatDate(d.uploaded_at)}</td>
              <td>${escapeHTML(d.patient_name || 'Unknown')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(d.doc_type)}</span></td>
              <td>${escapeHTML(d.file_name)}</td>
              <td>${(d.file_size / 1024).toFixed(1)} KB</td>
              <td>${escapeHTML(d.uploader_name || 'Unknown')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

async function bindEvents(container) {
  const modal = container.querySelector('#doc-modal');
  const form = container.querySelector('#doc-form');

  container.querySelector('#new-doc-btn')?.addEventListener('click', async () => {
    await populatePatients(container);
    modal.style.display = 'flex';
  });

  container.querySelector('#close-doc-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-doc')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#doc-patient')?.value,
      doc_type: container.querySelector('#doc-type')?.value,
      file_name: container.querySelector('#doc-filename')?.value,
      file_size: parseInt(container.querySelector('#doc-filesize')?.value) || 0,
    };
    try {
      await apiFetch('/documents', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Document uploaded', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to upload document', 'error');
    }
  });

  container.querySelector('#doc-filter-type')?.addEventListener('change', () => refreshList(container));
}

async function populatePatients(container) {
  const select = container.querySelector('#doc-patient');
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
