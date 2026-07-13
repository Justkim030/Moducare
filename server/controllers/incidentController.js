const db = require('../config/db');
const { hasCapability } = require('../config/permissions');
const { sanitizeString } = require('../middleware/validation');

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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'incident:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const search = (params.get('q') || '').toLowerCase();
  const severity = params.get('severity') || '';
  const statusParam = params.get('status') || '';
  const page = parseInt(params.get('page')) || 1;
  const limit = Math.min(Math.max(parseInt(params.get('limit')) || 25, 1), 100);
  const offset = (page - 1) * limit;

  let sql = `SELECT i.id, i.created, i.title, i.description, i.status, i.severity, i.employee_id, e.name as reporter_name, i.category, i.patient_id, i.time, i.reporter_role, i.action_taken, i.witness_name FROM incidents i LEFT JOIN employees e ON e.id = i.employee_id WHERE 1=1`;
  const args = [];

  if (search) {
    sql += ` AND (LOWER(i.title) LIKE ? OR LOWER(i.description) LIKE ? OR LOWER(i.category) LIKE ?)`;
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (severity) {
    sql += ` AND i.severity = ?`;
    args.push(severity);
  }
  if (statusParam) {
    sql += ` AND i.status = ?`;
    args.push(statusParam);
  }

  let countSql = `SELECT COUNT(*) as total FROM incidents i WHERE 1=1`;
  const countArgs = [];
  if (search) {
    countSql += ` AND (LOWER(i.title) LIKE ? OR LOWER(i.description) LIKE ? OR LOWER(i.category) LIKE ?)`;
    countArgs.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (severity) {
    countSql += ` AND i.severity = ?`;
    countArgs.push(severity);
  }
  if (statusParam) {
    countSql += ` AND i.status = ?`;
    countArgs.push(statusParam);
  }

  sql += ` ORDER BY i.created DESC LIMIT ? OFFSET ?`;

  db.get(countSql, countArgs, (err, countRow) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Incidents List Count Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    db.all(sql, [...args, limit, offset], (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Incidents List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const incidents = (rows || []).map(r => ({
        id: r.id,
        created: r.created,
        title: r.title,
        description: r.description,
        status: r.status,
        severity: r.severity,
        employee_id: r.employee_id,
        reporter_name: r.reporter_name,
        category: r.category || '',
        patient_id: r.patient_id || '',
        time: r.time || '',
        reporter_role: r.reporter_role || '',
        action_taken: r.action_taken || '',
        witness_name: r.witness_name || '',
      }));
      return sendSecureJSON(res, 200, { ok: true, data: incidents, pagination: { page: page, limit: limit, total: total, totalPages: totalPages } });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'incident:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get(`SELECT i.id, i.created, i.title, i.description, i.status, i.severity, i.employee_id, e.name as reporter_name, i.category, i.patient_id, i.time, i.reporter_role, i.action_taken, i.witness_name FROM incidents i LEFT JOIN employees e ON e.id = i.employee_id WHERE i.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Incident Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Incident not found' });
    }
    return sendSecureJSON(res, 200, { ok: true, incident: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'incident:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { title, description, severity, status, employee_id, category, patient_id, time, reporter_role, action_taken, witness_name } = p;

      if (!title) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Title is required.' });
      }

      const now = new Date().toISOString();
      const sanitized = {
        title: sanitizeString(title),
        description: description ? sanitizeString(description) : '',
        category: category ? sanitizeString(category) : '',
        action_taken: action_taken ? sanitizeString(action_taken) : '',
      };

      db.run(`INSERT INTO incidents (created, title, description, status, severity, employee_id, category, patient_id, time, reporter_role, action_taken, witness_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [now, sanitized.title, sanitized.description, status || 'Reported', severity || 'S3', employee_id || null, sanitized.category, patient_id || '', time || '', reporter_role || '', sanitized.action_taken, witness_name || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Incident Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Incident creation failed.' });
          }
          const incId = this.lastID;
          db.run(`INSERT INTO audit (user_id, action, details, resource_type, status) VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, 'create_incident', `Created incident: ${sanitized.title}`, 'incident', 'success'],
            function (auditErr) {
              if (auditErr) {
                console.error(`[AUDIT] Log failed: ${auditErr.message}`);
              }
              return sendSecureJSON(res, 201, {
                ok: true,
                incident: { id: incId, created: now, title: sanitized.title, description: sanitized.description, status, severity, employee_id },
              });
            }
          );
        }
      );
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'incident:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { title, description, status, severity, employee_id, category, patient_id, time, reporter_role, action_taken, witness_name } = p;

      const fields = [];
      const values = [];
      if (title !== undefined) { fields.push('title = ?'); values.push(sanitizeString(title)); }
      if (description !== undefined) { fields.push('description = ?'); values.push(sanitizeString(description)); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (severity !== undefined) { fields.push('severity = ?'); values.push(severity); }
      if (employee_id !== undefined) { fields.push('employee_id = ?'); values.push(employee_id); }
      if (category !== undefined) { fields.push('category = ?'); values.push(sanitizeString(category)); }
      if (patient_id !== undefined) { fields.push('patient_id = ?'); values.push(patient_id); }
      if (time !== undefined) { fields.push('time = ?'); values.push(time); }
      if (reporter_role !== undefined) { fields.push('reporter_role = ?'); values.push(sanitizeString(reporter_role)); }
      if (action_taken !== undefined) { fields.push('action_taken = ?'); values.push(sanitizeString(action_taken)); }
      if (witness_name !== undefined) { fields.push('witness_name = ?'); values.push(witness_name); }
      values.push(id);

      db.run(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Incident Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Incident not found.' });
        }
        db.run(`INSERT INTO audit (user_id, action, details, resource_type, status) VALUES (?, ?, ?, ?, ?)`,
          [req.user.id, 'update_incident', `Updated incident ${id}`, 'incident', 'success'],
          function (auditErr) {
            if (auditErr) {
              console.error(`[AUDIT] Log failed: ${auditErr.message}`);
            }
            return sendSecureJSON(res, 200, { ok: true });
          }
        );
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'incident:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run(`DELETE FROM incidents WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Incident Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Incident not found.' });
    db.run(`INSERT INTO audit (user_id, action, details, resource_type, status) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'delete_incident', `Deleted incident ${id}`, 'incident', 'success'],
      function (auditErr) {
        if (auditErr) {
          console.error(`[AUDIT] Log failed: ${auditErr.message}`);
        }
        return sendSecureJSON(res, 200, { ok: true });
      }
    );
  });
}

module.exports = {
  handleList,
  handleGet,
  handleCreate,
  handleUpdate,
  handleDelete
};
