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

function getUserId(req) {
  return (req && req.user && req.user.id) ? req.user.id : null;
}

function logAudit(userId, action, details, resourceType, resourceId, status) {
  db.run(
    `INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, details, resourceType, resourceId ? resourceId : null, status],
    (err) => {
      if (err) console.error(`[AUDIT] Log failed: ${err.message}`);
    }
  );
}

function parsePagination(params) {
  let page = parseInt(params.get('page') || '1', 10);
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(params.get('limit') || '25', 10);
  if (isNaN(limit) || limit < 1) limit = 25;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;
  return { page: page, limit: limit, offset: offset };
}

function getPathId(req) {
  const segs = req.url.split('?')[0].split('/').filter(Boolean);
  return segs[2] || '';
}

function handleList(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'staff:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const employeeId = params.get('employee_id') || '';
  const trainingType = params.get('training_type') || '';
  const status = params.get('status') || '';
  const { page, limit, offset } = parsePagination(params);

  const whereClauses = [];
  const args = [];
  if (employeeId) { whereClauses.push(`t.employee_id = ?`); args.push(employeeId); }
  if (trainingType) { whereClauses.push(`t.training_type = ?`); args.push(trainingType); }
  if (status) { whereClauses.push(`t.status = ?`); args.push(status); }
  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(DISTINCT t.id) as total FROM training_records t LEFT JOIN employees e ON e.id = t.employee_id${whereSql}`;

  db.get(countSql, args, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Training List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    const dataSql = `SELECT t.id, t.employee_id, e.name as employee_name, t.training_name, t.training_type, t.provider, t.start_date, t.end_date, t.status, t.certificate_url FROM training_records t LEFT JOIN employees e ON e.id = t.employee_id${whereSql} ORDER BY t.start_date DESC LIMIT ? OFFSET ?`;
    const dataArgs = args.concat([limit, offset]);

    db.all(dataSql, dataArgs, (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Training List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const total = countRow ? countRow.total : 0;
      const totalPages = Math.ceil(total / limit);
      return sendSecureJSON(res, 200, {
        ok: true,
        data: rows || [],
        pagination: { page: page, limit: limit, total: total, totalPages: totalPages }
      });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'staff:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = getPathId(req);
  const sql = `SELECT t.*, e.name as employee_name, e.role_id, e.department_id FROM training_records t LEFT JOIN employees e ON e.id = t.employee_id WHERE t.id = ?`;

  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Training Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Training record not found' });
    return sendSecureJSON(res, 200, { ok: true, data: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }

      const p = JSON.parse(body || '{}');
      const { employee_id, training_name, training_type, provider, start_date, end_date, status, certificate_url } = p;

      if (!employee_id || !training_name) {
        return sendSecureJSON(res, 400, { ok: false, error: 'employee_id and training_name are required.' });
      }

      const id = 'trn_' + Date.now();
      const trainingStatus = status || 'completed';

      db.run(`INSERT INTO training_records (id, employee_id, training_name, training_type, provider, start_date, end_date, status, certificate_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, employee_id, training_name, training_type || '', provider || '', start_date || null, end_date || null, trainingStatus, certificate_url || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Training Create Trace: ${err.message}`);
            logAudit(getUserId(req), 'create_training', `Failed to create training for ${employee_id}`, 'training', id, 'failed');
            return sendSecureJSON(res, 400, { ok: false, error: 'Training creation failed.' });
          }
          logAudit(getUserId(req), 'create_training', `Created training ${id} for ${employee_id}`, 'training', id, 'success');
          return sendSecureJSON(res, 201, { ok: true, data: { id: id, employee_id: employee_id, training_name: training_name, status: trainingStatus } });
        });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Training Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  const id = getPathId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }

      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['employee_id', 'training_name', 'training_type', 'provider', 'start_date', 'end_date', 'status', 'certificate_url'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });

      values.push(id);
      db.run(`UPDATE training_records SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Training Update Trace: ${err.message}`);
          logAudit(getUserId(req), 'update_training', `Failed to update training ${id}`, 'training', id, 'failed');
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Training record not found.' });
        logAudit(getUserId(req), 'update_training', `Updated training ${id}`, 'training', id, 'success');
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Training Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = getPathId(req);
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  db.run(`DELETE FROM training_records WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Training Delete Trace: ${err.message}`);
      logAudit(getUserId(req), 'delete_training', `Failed to delete training ${id}`, 'training', id, 'failed');
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Training record not found.' });
    logAudit(getUserId(req), 'delete_training', `Deleted training ${id}`, 'training', id, 'success');
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
