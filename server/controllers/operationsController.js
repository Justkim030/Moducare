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
  const priority = params.get('priority') || '';
  const search = (params.get('q') || '').toLowerCase();

  let sql = `SELECT o.id, o.title, o.description, o.department, o.priority, o.status, o.assignee, o.due, o.tags, o.notes, o.employee_id, e.name as owner FROM operations o LEFT JOIN employees e ON e.id = o.employee_id WHERE 1=1`;
  const args = [];

  if (status) {
    sql += ` AND o.status = ?`;
    args.push(status);
  }
  if (priority) {
    sql += ` AND o.priority = ?`;
    args.push(priority);
  }
  if (search) {
    sql += ` AND (LOWER(o.title) LIKE ? OR LOWER(o.description) LIKE ? OR LOWER(o.assignee) LIKE ?)`;
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY o.due ASC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Operations List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const operations = (rows || []).map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      department: r.department,
      priority: r.priority,
      status: r.status,
      assignee: r.assignee,
      due: r.due,
      tags: r.tags ? JSON.parse(r.tags) : [],
      notes: r.notes,
      employee_id: r.employee_id,
      owner: r.owner,
    }));
    return sendSecureJSON(res, 200, { ok: true, operations });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT o.id, o.title, o.description, o.department, o.priority, o.status, o.assignee, o.due, o.tags, o.notes, o.employee_id, e.name as owner FROM operations o LEFT JOIN employees e ON e.id = o.employee_id WHERE o.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Operation Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Operation not found' });
    }
    return sendSecureJSON(res, 200, {
      ok: true,
      operation: {
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : [],
      }
    });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { title, description, department, priority, status, assignee, due, tags, notes, employee_id } = p;

      if (!title) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Title is required.' });
      }

      db.run(
        `INSERT INTO operations (title, description, department, priority, status, assignee, due, tags, notes, employee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description || '',
          department || 'General',
          priority || 'medium',
          status || 'referred',
          assignee || '',
          due || '',
          tags ? JSON.stringify(tags) : '[]',
          notes || '',
          employee_id || null
        ],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Operation Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Operation creation failed.' });
          }
          return sendSecureJSON(res, 201, {
            ok: true,
            operation: { id: this.lastID, title, description, department, priority, status, assignee, due, tags, notes, employee_id },
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
      const { title, description, department, priority, status, assignee, due, tags, notes, employee_id } = p;

      const fields = [];
      const values = [];
      if (title !== undefined) { fields.push('title = ?'); values.push(title); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description); }
      if (department !== undefined) { fields.push('department = ?'); values.push(department); }
      if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (assignee !== undefined) { fields.push('assignee = ?'); values.push(assignee); }
      if (due !== undefined) { fields.push('due = ?'); values.push(due); }
      if (tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(tags)); }
      if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
      if (employee_id !== undefined) { fields.push('employee_id = ?'); values.push(employee_id); }
      values.push(id);

      db.run(`UPDATE operations SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Operation Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Operation not found.' });
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
  db.run(`DELETE FROM operations WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Operation Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Operation not found.' });
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
