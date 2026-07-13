const db = require('../config/db');
const { hasCapability } = require('../config/permissions');

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

function logAudit(userId, action, details, resourceType, resourceId) {
  db.run(
    'INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, action, details, resourceType, resourceId || '', 'success'],
    function (err) {
      if (err) console.error(`[AUDIT ERROR] ${err.message}`);
    }
  );
}

function handleList(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'appointment:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const patientId = params.get('patient_id') || '';
  const status = params.get('status') || '';
  const reminderDue = params.get('reminder_due') || '';
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit')) || 25));
  const offset = (page - 1) * limit;

  let whereClause = ' WHERE 1=1';
  const args = [];

  if (patientId) { whereClause += ' AND a.patient_id = ?'; args.push(patientId); }
  if (status) { whereClause += ' AND a.status = ?'; args.push(status); }
  if (reminderDue) { whereClause += ' AND a.reminder_due <= ?'; args.push(reminderDue); }

  const countSql = 'SELECT COUNT(*) as total FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees emp ON emp.id = a.employee_id' + whereClause;

  db.get(countSql, args, function (countErr, countRow) {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Appointments List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    const total = countRow ? countRow.total : 0;
    const dataSql = 'SELECT a.id, a.time, a.patient_id, a.type, a.status, a.employee_id, a.reminder_due, a.reminder_sent, a.notes, p.name as patient_name, emp.name as provider_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees emp ON emp.id = a.employee_id' + whereClause + ' ORDER BY a.time ASC LIMIT ? OFFSET ?';
    const dataArgs = args.concat([limit, offset]);

    db.all(dataSql, dataArgs, function (err, rows) {
      if (err) {
        console.error(`[SECURE EXCEPTION] Appointments List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, {
        ok: true,
        appointments: rows || [],
        pagination: { page: page, limit: limit, total: total, totalPages: Math.ceil(total / limit) }
      });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'appointment:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get('SELECT a.id, a.time, a.patient_id, a.type, a.status, a.employee_id, a.reminder_due, a.reminder_sent, a.notes, p.name as patient_name, emp.name as provider_name FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id LEFT JOIN employees emp ON emp.id = a.employee_id WHERE a.id = ?', [id], function (err, row) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointment Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found' });
    return sendSecureJSON(res, 200, { ok: true, appointment: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'appointment:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', function (ch) { body += ch; });
  req.on('end', function () {
    try {
      const p = JSON.parse(body || '{}');
      const time = p.time;
      const patient_id = p.patient_id;
      const type = p.type;
      const status = p.status;
      const employee_id = p.employee_id;
      const reminder_due = p.reminder_due;
      const notes = p.notes;

      if (!patient_id || !time) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and time are required.' });
      }
      db.run('INSERT INTO appointments (time, patient_id, type, status, employee_id, reminder_due, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [time, patient_id, type || 'Consultation', status || 'scheduled', employee_id || null, reminder_due || '', notes || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Appointment Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Appointment creation failed.' });
          }
          const newId = this.lastID;
          logAudit(req.user.id, 'create_appointment', 'Created appointment ' + newId, 'appointment', String(newId));
          return sendSecureJSON(res, 201, { ok: true, appointment: { id: newId, time: time, patient_id: patient_id, type: type, status: status } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'appointment:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', function (ch) { body += ch; });
  req.on('end', function () {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['time', 'patient_id', 'type', 'status', 'employee_id', 'reminder_due', 'reminder_sent', 'notes'];
      for (var i = 0; i < allowed.length; i++) {
        var k = allowed[i];
        if (p[k] !== undefined) { fields.push(k + ' = ?'); values.push(p[k]); }
      }
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run('UPDATE appointments SET ' + fields.join(', ') + ' WHERE id = ?', values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Appointment Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found.' });
        logAudit(req.user.id, 'update_appointment', 'Updated appointment ' + id, 'appointment', String(id));
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'appointment:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run('DELETE FROM appointments WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Appointment Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Appointment not found.' });
    logAudit(req.user.id, 'delete_appointment', 'Deleted appointment ' + id, 'appointment', String(id));
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
