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

function handleList(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const category = params.get('category') || '';
  const status = params.get('status') || '';

  let sql = `SELECT s.* FROM suppliers s WHERE 1=1`;
  const args = [];

  if (category) { sql += ` AND s.category = ?`; args.push(category); }
  if (status) { sql += ` AND s.status = ?`; args.push(status); }

  sql += ` ORDER BY s.name ASC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Suppliers List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, suppliers: rows || [] });
  });
}

function handleGet(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const id = req.url.split('/').pop();
  db.get(`SELECT s.* FROM suppliers s WHERE s.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Suppliers Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Supplier not found.' });
    }
    return sendSecureJSON(res, 200, { ok: true, supplier: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { name, contact_person, email, phone, address, category, status } = p;
      if (!name) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Supplier name is required.' });
      }
      const id = 'sup_' + Date.now();
      db.run(`INSERT INTO suppliers (id, name, contact_person, email, phone, address, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, contact_person || '', email || '', phone || '', address || '', category || 'general', status || 'active'],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Suppliers Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Supplier creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, supplier: { id, name, contact_person, email, phone, address, category: category || 'general', status: status || 'active' } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['name', 'contact_person', 'email', 'phone', 'address', 'category', 'status'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Suppliers Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Supplier not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM suppliers WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Suppliers Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Supplier not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
