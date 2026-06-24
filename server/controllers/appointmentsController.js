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
  const reminderDue = params.get('reminder_due') || '';

  let sql = `SELECT a.id, a.time, a.patient_id, a.type, a.status, a.employee_id, a.reminder_due, a.reminder_sent, a.notes, p.name as patient_name, emp.name as provider_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees emp ON emp.id = a.employee_id WHERE 1=1`;
  const args = [];

  if (patientId) { sql += ` AND a.patient_id = ?`; args.push(patientId); }
  if (status) { sql += ` AND a.status = ?`; args.push(status); }
  if (reminderDue) { sql += ` AND a.reminder_due <= ?`; args.push(reminderDue); }

  sql += ` ORDER BY a.time ASC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointments List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, appointments: rows || [] });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT a.id, a.time, a.patient_id, a.type, a.status, a.employee_id, a.reminder_due, a.reminder_sent, a.notes, p.name as patient_name, emp.name as provider_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees emp ON emp.id = a.employee_id WHERE a.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointment Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found' });
    return sendSecureJSON(res, 200, { ok: true, appointment: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { time, patient_id, type, status, employee_id, reminder_due, notes } = p;
      if (!patient_id || !time) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and time are required.' });
      }
      db.run(`INSERT INTO appointments (time, patient_id, type, status, employee_id, reminder_due, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [time, patient_id, type || 'Consultation', status || 'scheduled', employee_id || null, reminder_due || '', notes || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Appointment Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Appointment creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, appointment: { id: this.lastID, time, patient_id, type, status } });
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
      const allowed = ['time', 'patient_id', 'type', 'status', 'employee_id', 'reminder_due', 'reminder_sent', 'notes'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Appointment Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found.' });
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
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
