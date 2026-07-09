/**
 * ModuCare MS — Documents Module
 * Features: Document vault, upload records, document type filtering
 */
import { showToast, formatDate, escapeHTML, apiFetch, extractList, buildPaginationHTML, attachPagination } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let docPage = 1;
const DOC_PAGE_SIZE = 25;
let docTotal = 0;
let docTotalPages = 1;
let editingDocId = null;

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
l.rel = 'stylesheet';
   l.href = '/src/features/documents/styles.css';
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
  const docType = container.querySelector('#doc-filter-type').value || '';
  const qs = new URLSearchParams();
  qs.set('page', docPage);
  qs.set('limit', DOC_PAGE_SIZE);
  if (docType) qs.set('doc_type', docType);

  let data;
  try {
    data = await apiFetch(`/documents?${qs.toString()}`);
  } catch (err) {
    showToast(err.message || 'Failed to load documents', 'error');
    list.innerHTML = `<div class="empty-state"><h3>Failed to load documents</h3></div>`;
    return;
  }

  const docs = extractList(data, 'documents');
  const pag = data.pagination || {};
  docTotal = pag.total || docs.length;
  docTotalPages = pag.totalPages || 1;
  if (docPage > docTotalPages) { docPage = docTotalPages; return refreshList(container); }

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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${docs.map(d => `
            <tr>
              <td>${formatDate(d.uploaded_at)}</td>
              <td>${escapeHTML(d.patient_name || 'Unknown')}</td>
              <td><span class="badge badge-neutral">${escapeHTML(d.doc_type)}</span></td>
              <td>${escapeHTML(d.file_name)}</td>
              <td>${d.file_size ? (d.file_size / 1024).toFixed(1) + ' KB' : '—'}</td>
              <td>${escapeHTML(d.uploader_name || 'Unknown')}</td>
              <td class="doc-actions">
                <button class="mc-btn btn-sm btn-ghost doc-edit" data-id="${escapeHTML(String(d.id))}">Edit</button>
                <button class="mc-btn btn-sm btn-danger doc-delete" data-id="${escapeHTML(String(d.id))}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${buildPaginationHTML(docPage, DOC_PAGE_SIZE, docTotal)}
    </div>`;

  list.querySelectorAll('.doc-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const doc = docs.find(x => String(x.id) === btn.dataset.id);
      if (doc) showEditForm(container, doc);
    });
  });
  list.querySelectorAll('.doc-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteDoc(container, btn.dataset.id));
  });

  attachPagination(list.querySelector('.pagination'), { get page() { return docPage; }, set page(v) { docPage = v; } }, () => refreshList(container));
}

async function deleteDoc(container, id) {
  if (!confirm('Delete this document?')) return;
  try {
    await apiFetch(`/documents/${id}`, { method: 'DELETE' });
    showToast('Document deleted', 'success');
    refreshList(container);
  } catch (err) {
    showToast(err.message || 'Failed to delete document', 'error');
  }
}

async function bindEvents(container) {
  const modal = container.querySelector('#doc-modal');
  const form = container.querySelector('#doc-form');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;

  container.querySelector('#new-doc-btn').addEventListener('click', async () => {
    editingDocId = null;
    if (modalTitle) modalTitle.textContent = 'Upload Document';
    await populatePatients(container);
    form.reset();
    modal.style.display = 'flex';
  });

  container.querySelector('#close-doc-modal').addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-doc').addEventListener('click', () => { modal.style.display = 'none'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      patient_id: container.querySelector('#doc-patient').value,
      doc_type: container.querySelector('#doc-type').value,
      file_name: container.querySelector('#doc-filename').value,
      file_size: parseInt(container.querySelector('#doc-filesize').value) || 0,
    };
    try {
      if (editingDocId) {
        await apiFetch(`/documents/${editingDocId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Document updated', 'success');
      } else {
        await apiFetch('/documents', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Document uploaded', 'success');
      }
      editingDocId = null;
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch (err) {
      showToast(err.message || 'Failed to save document', 'error');
    }
  });

  container.querySelector('#doc-filter-type').addEventListener('change', () => { docPage = 1; refreshList(container); });
}

async function showEditForm(container, doc) {
  editingDocId = doc.id;
  const modal = container.querySelector('#doc-modal');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
  if (!modal) return;
  if (modalTitle) modalTitle.textContent = 'Edit Document';
  await populatePatients(container);
  container.querySelector('#doc-patient').value = doc.patient_id || '';
  container.querySelector('#doc-type').value = doc.doc_type || '';
  container.querySelector('#doc-filename').value = doc.file_name || '';
  container.querySelector('#doc-filesize').value = doc.file_size || 0;
  modal.style.display = 'flex';
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
