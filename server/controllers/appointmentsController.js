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
  const search = (params.get('q') || '').toLowerCase();
  const status = params.get('status') || '';
  const dateFrom = params.get('from') || '';
  const dateTo = params.get('to') || '';

  let sql = `SELECT a.id, a.time, a.type, a.status, a.patient_id, p.name as patient_name, a.employee_id, e.name as doctor FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees e ON e.id = a.employee_id WHERE 1=1`;
  const args = [];

  if (search) {
    sql += ` AND (LOWER(p.name) LIKE ? OR LOWER(a.type) LIKE ? OR LOWER(a.status) LIKE ?)`;
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += ` AND a.status = ?`;
    args.push(status);
  }
  if (dateFrom) {
    sql += ` AND a.time >= ?`;
    args.push(dateFrom);
  }
  if (dateTo) {
    sql += ` AND a.time <= ?`;
    args.push(dateTo);
  }

  sql += ` ORDER BY a.time DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointments List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const appointments = (rows || []).map(r => ({
      id: r.id,
      time: r.time,
      type: r.type,
      status: r.status,
      patient_id: r.patient_id,
      patient_name: r.patient_name,
      employee_id: r.employee_id,
      doctor: r.doctor,
    }));
    return sendSecureJSON(res, 200, { ok: true, appointments });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT a.id, a.time, a.type, a.status, a.patient_id, p.name as patient_name, a.employee_id, e.name as doctor FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointment Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found' });
    }
    return sendSecureJSON(res, 200, { ok: true, appointment: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { time, type, status, patient_id, employee_id } = p;

      if (!time || !patient_id || !employee_id) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Time, patient, and doctor are required.' });
      }

      db.run(`INSERT INTO appointments (time, type, status, patient_id, employee_id) VALUES (?, ?, ?, ?, ?)`,
        [time, type || 'Consultation', status || 'scheduled', patient_id, employee_id],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Appointment Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Appointment creation failed.' });
          }
          return sendSecureJSON(res, 201, {
            ok: true,
            appointment: { id: this.lastID, time, type, status, patient_id, employee_id },
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
      const { time, type, status, patient_id, employee_id } = p;

      const fields = [];
      const values = [];
      if (time !== undefined) { fields.push('time = ?'); values.push(time); }
      if (type !== undefined) { fields.push('type = ?'); values.push(type); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (patient_id !== undefined) { fields.push('patient_id = ?'); values.push(patient_id); }
      if (employee_id !== undefined) { fields.push('employee_id = ?'); values.push(employee_id); }
      values.push(id);

      db.run(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Appointment Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found.' });
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
  db.run(`DELETE FROM appointments WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointment Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found.' });
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
