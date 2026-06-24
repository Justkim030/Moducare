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
  const lowStock = params.get('low_stock') || '';
  const category = params.get('category') || '';

  let sql = `SELECT i.id, i.name, i.category, i.current_stock, i.reorder_level, i.unit, i.last_restocked, i.supplier FROM inventory i WHERE 1=1`;
  const args = [];

  if (lowStock === 'true') { sql += ` AND i.current_stock <= i.reorder_level`; }
  if (category) { sql += ` AND i.category = ?`; args.push(category); }

  sql += ` ORDER BY i.name ASC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Inventory List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, inventory: rows || [] });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { name, category, current_stock, reorder_level, unit, supplier } = p;
      if (!name) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Item name is required.' });
      }
      db.run(`INSERT INTO inventory (name, category, current_stock, reorder_level, unit, supplier) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, category || 'other', current_stock || 0, reorder_level || 10, unit || '', supplier || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Inventory Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Inventory item creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, inventory: { id: this.lastID, name, category, current_stock } });
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
      const allowed = ['name', 'category', 'current_stock', 'reorder_level', 'unit', 'supplier'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Inventory Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Inventory item not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM inventory WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Inventory Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Inventory item not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleCreate, handleUpdate, handleDelete };
