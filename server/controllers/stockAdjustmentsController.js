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

function getParam(req, name) {
  const q = req.url.split('?')[1] || '';
  return new URLSearchParams(q).get(name);
}

function getId(req) {
  const parts = req.url.split('/');
  return parts[parts.length - 1];
}

function handleList(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const inventoryId = getParam(req, 'inventory_id') || '';
  let sql = `SELECT sa.*, i.name as inventory_name FROM stock_adjustments sa LEFT JOIN inventory i ON i.id = sa.inventory_id WHERE 1=1`;
  const args = [];
  if (inventoryId) { sql += ` AND sa.inventory_id = ?`; args.push(inventoryId); }
  sql += ` ORDER BY sa.created_at DESC`;
  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] StockAdjustments List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, adjustments: rows || [] });
  });
}

function handleGet(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const id = getId(req);
  db.get(`SELECT sa.*, i.name as inventory_name FROM stock_adjustments sa LEFT JOIN inventory i ON i.id = sa.inventory_id WHERE sa.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] StockAdjustments Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Stock adjustment not found.' });
    }
    return sendSecureJSON(res, 200, { ok: true, adjustment: row });
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
      const { inventory_id, adjustment_type, quantity_change, reason, reference_id } = p;
      if (!inventory_id) {
        return sendSecureJSON(res, 400, { ok: false, error: 'inventory_id is required.' });
      }
      if (!adjustment_type) {
        return sendSecureJSON(res, 400, { ok: false, error: 'adjustment_type is required.' });
      }
      const qty = parseFloat(quantity_change);
      if (isNaN(qty)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'quantity_change must be a number.' });
      }
      const id = 'adj_' + Date.now();

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', () => {
          db.run(`INSERT INTO stock_adjustments (id, inventory_id, adjustment_type, quantity_change, reason, reference_id, performed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, inventory_id, adjustment_type, qty, reason || '', reference_id || null, req.user.id || null],
            function (err) {
              if (err) {
                db.run('ROLLBACK', () => {});
                console.error(`[SECURE EXCEPTION] StockAdjustment Create Trace: ${err.message}`);
                return sendSecureJSON(res, 400, { ok: false, error: 'Adjustment creation failed.' });
              }
              db.run(`UPDATE inventory SET current_stock = current_stock + ? WHERE id = ?`, [qty, inventory_id], function (uErr) {
                if (uErr) {
                  db.run('ROLLBACK', () => {});
                  console.error(`[SECURE EXCEPTION] StockAdjustment Inventory Update Trace: ${uErr.message}`);
                  return sendSecureJSON(res, 500, { ok: false, error: 'Failed to update inventory stock.' });
                }
                db.run('COMMIT', () => sendSecureJSON(res, 201, { ok: true, adjustment: { id, inventory_id, adjustment_type, quantity_change: qty, reason, reference_id } }));
              });
            });
        });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

module.exports = { handleList, handleGet, handleCreate };
