const db = require('../config/db');

function sendSecureJSON(res, status, data) {
  const payload = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  res.end(payload);
}

function handleList(req, res) {
  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const patientId = params.get('patient_id') || '';
  const docType = params.get('doc_type') || '';

  let sql = `SELECT d.id, d.patient_id, d.doc_type, d.file_name, d.file_size, d.uploaded_at, d.uploaded_by, p.name as patient_name, emp.name as uploader_name FROM documents d LEFT JOIN patients p ON p.id = d.patient_id LEFT JOIN employees emp ON emp.id = d.uploaded_by WHERE 1=1`;
  const args = [];

  if (patientId) { sql += ` AND d.patient_id = ?`; args.push(patientId); }
  if (docType) { sql += ` AND d.doc_type = ?`; args.push(docType); }

  sql += ` ORDER BY d.uploaded_at DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Documents List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, documents: rows || [] });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT d.id, d.patient_id, d.doc_type, d.file_name, d.file_size, d.uploaded_at, d.uploaded_by, p.name as patient_name, emp.name as uploader_name FROM documents d LEFT JOIN patients p ON p.id = d.patient_id LEFT JOIN employees emp ON emp.id = d.uploaded_by WHERE d.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Document Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Document not found' });
    return sendSecureJSON(res, 200, { ok: true, document: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, doc_type, file_name, file_size, uploaded_by } = p;
      if (!patient_id || !file_name) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and file name are required.' });
      }
      db.run(`INSERT INTO documents (patient_id, doc_type, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
        [patient_id, doc_type || 'other', file_name, file_size || 0, uploaded_by || null],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Document Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Document creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, document: { id: this.lastID, patient_id, doc_type, file_name } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['patient_id', 'doc_type', 'file_name', 'file_size', 'uploaded_by'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Document Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Document not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM documents WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Document Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Document not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
