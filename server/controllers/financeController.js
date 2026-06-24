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
  const status = params.get('status') || '';
  const type = params.get('type') || '';

  let sql = `SELECT f.id, f.type, f.reference, f.amount, f.status, f.date, f.due, f.employee_id, e.name as staff, f.patient_id, p.name as patient FROM finance f LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN patients p ON p.id = f.patient_id WHERE 1=1`;
  const args = [];

  if (status) {
    sql += ` AND f.status = ?`;
    args.push(status);
  }
  if (type) {
    sql += ` AND f.type = ?`;
    args.push(type);
  }

  sql += ` ORDER BY f.date DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Finance List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const records = (rows || []).map(r => ({
      id: r.id,
      type: r.type,
      reference: r.reference,
      amount: r.amount,
      status: r.status,
      date: r.date,
      due: r.due,
      employee_id: r.employee_id,
      staff: r.staff,
      patient_id: r.patient_id,
      patient: r.patient,
    }));
    return sendSecureJSON(res, 200, { ok: true, records });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT f.id, f.type, f.reference, f.amount, f.status, f.date, f.due, f.employee_id, e.name as staff, f.patient_id, p.name as patient FROM finance f LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN patients p ON p.id = f.patient_id WHERE f.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Finance Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Record not found' });
    }
    return sendSecureJSON(res, 200, { ok: true, record: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { type, reference, amount, status, date, due, employee_id, patient_id } = p;

      if (!type || !amount || !employee_id) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Type, amount, and staff are required.' });
      }

      db.run(`INSERT INTO finance (type, reference, amount, status, date, due, employee_id, patient_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [type, reference || '', amount, status || 'pending', date || new Date().toISOString().split('T')[0], due || '', employee_id, patient_id || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Finance Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Record creation failed.' });
          }
          return sendSecureJSON(res, 201, {
            ok: true,
            record: { id: this.lastID, type, reference, amount, status, date, due, employee_id, patient_id },
          });
        }
      );
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
      const { type, reference, amount, status, date, due, employee_id, patient_id } = p;

      const fields = [];
      const values = [];
      if (type !== undefined) { fields.push('type = ?'); values.push(type); }
      if (reference !== undefined) { fields.push('reference = ?'); values.push(reference); }
      if (amount !== undefined) { fields.push('amount = ?'); values.push(amount); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (date !== undefined) { fields.push('date = ?'); values.push(date); }
      if (due !== undefined) { fields.push('due = ?'); values.push(due); }
      if (employee_id !== undefined) { fields.push('employee_id = ?'); values.push(employee_id); }
      if (patient_id !== undefined) { fields.push('patient_id = ?'); values.push(patient_id); }
      values.push(id);

      db.run(`UPDATE finance SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Finance Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Record not found.' });
        }
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM finance WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Finance Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Record not found.' });
    }
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = {
  handleList,
  handleGet,
  handleCreate,
  handleUpdate,
  handleDelete
};
