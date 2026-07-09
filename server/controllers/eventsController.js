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
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  const type = params.get('type') || '';
  const employee_id = params.get('employee_id') || '';
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit')) || 25));
  const offset = (page - 1) * limit;

  let whereClause = ' WHERE 1=1';
  const args = [];

  if (start) { whereClause += ' AND e.start_time >= ?'; args.push(start); }
  if (end) { whereClause += ' AND e.start_time <= ?'; args.push(end); }
  if (type) { whereClause += ' AND e.type = ?'; args.push(type); }
  if (employee_id) { whereClause += ' AND e.employee_id = ?'; args.push(employee_id); }

  const countSql = 'SELECT COUNT(*) as total FROM events e LEFT JOIN employees emp ON emp.id = e.employee_id' + whereClause;

  db.get(countSql, args, function (countErr, countRow) {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Events List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    const total = countRow ? countRow.total : 0;
    const dataSql = 'SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.type, e.status, e.employee_id, e.color, emp.name as employee_name FROM events e LEFT JOIN employees emp ON emp.id = e.employee_id' + whereClause + ' ORDER BY e.start_time ASC LIMIT ? OFFSET ?';
    const dataArgs = args.concat([limit, offset]);

    db.all(dataSql, dataArgs, function (err, rows) {
      if (err) {
        console.error(`[SECURE EXCEPTION] Events List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, {
        ok: true,
        events: rows || [],
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
  db.get('SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.type, e.status, e.employee_id, e.color, emp.name as employee_name FROM events e LEFT JOIN employees emp ON emp.id = e.employee_id WHERE e.id = ?', [id], function (err, row) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Event Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Event not found' });
    return sendSecureJSON(res, 200, { ok: true, event: row });
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
      const title = p.title;
      const description = p.description;
      const start_time = p.start_time;
      const end_time = p.end_time;
      const type = p.type;
      const status = p.status;
      const employee_id = p.employee_id;
      const color = p.color;

      if (!title || !start_time) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Title and start time are required.' });
      }
      db.run('INSERT INTO events (title, description, start_time, end_time, type, status, employee_id, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [title, description || '', start_time, end_time || '', type || 'shift', status || 'scheduled', employee_id || null, color || '#3b82f6'],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Event Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Event creation failed.' });
          }
          const newId = this.lastID;
          logAudit(req.user.id, 'create_event', 'Created event ' + newId, 'event', String(newId));
          return sendSecureJSON(res, 201, { ok: true, event: { id: newId, title: title, start_time: start_time, type: type } });
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
      const allowed = ['title', 'description', 'start_time', 'end_time', 'type', 'status', 'employee_id', 'color'];
      for (var i = 0; i < allowed.length; i++) {
        var k = allowed[i];
        if (p[k] !== undefined) { fields.push(k + ' = ?'); values.push(p[k]); }
      }
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run('UPDATE events SET ' + fields.join(', ') + ' WHERE id = ?', values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Event Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Event not found.' });
        logAudit(req.user.id, 'update_event', 'Updated event ' + id, 'event', String(id));
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
  db.run('DELETE FROM events WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Event Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Event not found.' });
    logAudit(req.user.id, 'delete_event', 'Deleted event ' + id, 'event', String(id));
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
