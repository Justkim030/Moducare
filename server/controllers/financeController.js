const db = require('../config/db');
const { validateRequired, validateUUID } = require('../middleware/validation');
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
  if (!req.user || !hasCapability(req.user.role_id, 'finance:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const status = params.get('status') || '';
  const type = params.get('type') || '';
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit')) || 25));
  const offset = (page - 1) * limit;

  let whereClause = ' WHERE 1=1';
  const args = [];

  if (status) {
    whereClause += ' AND f.status = ?';
    args.push(status);
  }
  if (type) {
    whereClause += ' AND f.type = ?';
    args.push(type);
  }

  const countSql = 'SELECT COUNT(*) as total FROM finance f LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN patients p ON p.id = f.patient_id' + whereClause;

  db.get(countSql, args, function (countErr, countRow) {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Finance List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    const total = countRow ? countRow.total : 0;
    const dataSql = 'SELECT f.id, f.type, f.reference, f.amount, f.status, f.date, f.due, f.employee_id, e.name as staff, f.patient_id, p.name as patient FROM finance f LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN patients p ON p.id = f.patient_id' + whereClause + ' ORDER BY f.date DESC LIMIT ? OFFSET ?';
    const dataArgs = args.concat([limit, offset]);

    db.all(dataSql, dataArgs, function (err, rows) {
      if (err) {
        console.error(`[SECURE EXCEPTION] Finance List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const records = (rows || []).map(function (r) {
        return {
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
        };
      });
      return sendSecureJSON(res, 200, {
        ok: true,
        records: records,
        pagination: { page: page, limit: limit, total: total, totalPages: Math.ceil(total / limit) }
      });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'finance:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get('SELECT f.id, f.type, f.reference, f.amount, f.status, f.date, f.due, f.employee_id, e.name as staff, f.patient_id, p.name as patient FROM finance f LEFT JOIN employees e ON e.id = f.employee_id LEFT JOIN patients p ON p.id = f.patient_id WHERE f.id = ?', [id], function (err, row) {
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
  if (!req.user || !hasCapability(req.user.role_id, 'finance:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', function (ch) { body += ch; });
  req.on('end', function () {
    try {
      const p = JSON.parse(body || '{}');
      const type = p.type;
      const reference = p.reference;
      const amount = p.amount;
      const status = p.status;
      const date = p.date;
      const due = p.due;
      const employee_id = p.employee_id;
      const patient_id = p.patient_id;

      const missing = validateRequired([type, amount, employee_id]);
      if (missing.length > 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Missing required fields: ' + missing.join(', ') });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Amount must be a positive number.' });
      }

      if (!validateUUID(employee_id)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid employee ID format.' });
      }

      if (patient_id && !validateUUID(patient_id)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid patient ID format.' });
      }

      db.run('INSERT INTO finance (type, reference, amount, status, date, due, employee_id, patient_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [type, reference || '', numAmount, status || 'pending', date || new Date().toISOString().split('T')[0], due || '', employee_id, patient_id || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Finance Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Record creation failed.' });
          }
          const newId = this.lastID;
          logAudit(req.user.id, 'create_finance', 'Created finance record ' + newId, 'finance', String(newId));
          return sendSecureJSON(res, 201, {
            ok: true,
            record: { id: newId, type: type, reference: reference, amount: numAmount, status: status, date: date, due: due, employee_id: employee_id, patient_id: patient_id },
          });
        }
      );
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'finance:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', function (ch) { body += ch; });
  req.on('end', function () {
    try {
      const p = JSON.parse(body || '{}');
      const type = p.type;
      const reference = p.reference;
      const amount = p.amount;
      const status = p.status;
      const date = p.date;
      const due = p.due;
      const employee_id = p.employee_id;
      const patient_id = p.patient_id;

      const fields = [];
      const values = [];
      if (type !== undefined) { fields.push('type = ?'); values.push(type); }
      if (reference !== undefined) { fields.push('reference = ?'); values.push(reference); }
      if (amount !== undefined) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return sendSecureJSON(res, 400, { ok: false, error: 'Amount must be a positive number.' });
        }
        fields.push('amount = ?');
        values.push(numAmount);
      }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (date !== undefined) { fields.push('date = ?'); values.push(date); }
      if (due !== undefined) { fields.push('due = ?'); values.push(due); }
      if (employee_id !== undefined) { fields.push('employee_id = ?'); values.push(employee_id); }
      if (patient_id !== undefined) { fields.push('patient_id = ?'); values.push(patient_id); }
      values.push(id);

      db.run('UPDATE finance SET ' + fields.join(', ') + ' WHERE id = ?', values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Finance Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Record not found.' });
        }
        logAudit(req.user.id, 'update_finance', 'Updated finance record ' + id, 'finance', String(id));
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'finance:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run('DELETE FROM finance WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Finance Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Record not found.' });
    }
    logAudit(req.user.id, 'delete_finance', 'Deleted finance record ' + id, 'finance', String(id));
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
