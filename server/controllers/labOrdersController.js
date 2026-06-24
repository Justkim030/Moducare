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
  const status = params.get('status') || '';
  const testType = params.get('test_type') || '';

  let sql = `SELECT lo.id, lo.patient_id, lo.encounter_id, lo.test_type, lo.test_name, lo.status, lo.result_value, lo.result_unit, lo.reference_range, lo.abnormal_flag, lo.result_date, lo.ordering_provider_id, lo.notes, p.name as patient_name, emp.name as provider_name FROM lab_orders lo LEFT JOIN patients p ON p.id = lo.patient_id LEFT JOIN employees emp ON emp.id = lo.ordering_provider_id WHERE 1=1`;
  const args = [];

  if (patientId) { sql += ` AND lo.patient_id = ?`; args.push(patientId); }
  if (status) { sql += ` AND lo.status = ?`; args.push(status); }
  if (testType) { sql += ` AND lo.test_type = ?`; args.push(testType); }

  sql += ` ORDER BY lo.result_date DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Lab Orders List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, labOrders: rows || [] });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT lo.id, lo.patient_id, lo.encounter_id, lo.test_type, lo.test_name, lo.status, lo.result_value, lo.result_unit, lo.reference_range, lo.abnormal_flag, lo.result_date, lo.ordering_provider_id, lo.notes, p.name as patient_name, emp.name as provider_name FROM lab_orders lo LEFT JOIN patients p ON p.id = lo.patient_id LEFT JOIN employees emp ON emp.id = lo.ordering_provider_id WHERE lo.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Lab Order Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Lab order not found' });
    return sendSecureJSON(res, 200, { ok: true, labOrder: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, encounter_id, test_type, test_name, status, result_value, result_unit, reference_range, abnormal_flag, result_date, ordering_provider_id, notes } = p;
      if (!patient_id || !test_type) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and test type are required.' });
      }
      db.run(`INSERT INTO lab_orders (patient_id, encounter_id, test_type, test_name, status, result_value, result_unit, reference_range, abnormal_flag, result_date, ordering_provider_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, encounter_id || null, test_type, test_name || '', status || 'ordered', result_value || '', result_unit || '', reference_range || '', abnormal_flag || '', result_date || '', ordering_provider_id || null, notes || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Lab Order Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Lab order creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, labOrder: { id: this.lastID, patient_id, test_type, test_name, status } });
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
      const allowed = ['patient_id', 'encounter_id', 'test_type', 'test_name', 'status', 'result_value', 'result_unit', 'reference_range', 'abnormal_flag', 'result_date', 'ordering_provider_id', 'notes'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE lab_orders SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Lab Order Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Lab order not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM lab_orders WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Lab Order Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Lab order not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
