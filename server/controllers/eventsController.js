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
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  const type = params.get('type') || '';
  const employee_id = params.get('employee_id') || '';

  let sql = `SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.type, e.status, e.employee_id, e.color, emp.name as employee_name FROM events e LEFT JOIN employees emp ON emp.id = e.employee_id WHERE 1=1`;
  const args = [];

  if (start) { sql += ` AND e.start_time >= ?`; args.push(start); }
  if (end) { sql += ` AND e.start_time <= ?`; args.push(end); }
  if (type) { sql += ` AND e.type = ?`; args.push(type); }
  if (employee_id) { sql += ` AND e.employee_id = ?`; args.push(employee_id); }

  sql += ` ORDER BY e.start_time ASC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Events List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, events: rows || [] });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.type, e.status, e.employee_id, e.color, emp.name as employee_name FROM events e LEFT JOIN employees emp ON emp.id = e.employee_id WHERE e.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Event Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Event not found' });
    return sendSecureJSON(res, 200, { ok: true, event: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { title, description, start_time, end_time, type, status, employee_id, color } = p;
      if (!title || !start_time) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Title and start time are required.' });
      }
      db.run(`INSERT INTO events (title, description, start_time, end_time, type, status, employee_id, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', start_time, end_time || '', type || 'shift', status || 'scheduled', employee_id || null, color || '#3b82f6'],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Event Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Event creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, event: { id: this.lastID, title, start_time, type } });
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
      const allowed = ['title', 'description', 'start_time', 'end_time', 'type', 'status', 'employee_id', 'color'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Event Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Event not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM events WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Event Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Event not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
