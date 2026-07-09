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
  const status = getParam(req, 'status') || '';
  let sql = `SELECT st.*, i.name as inventory_name FROM stock_transfers st LEFT JOIN inventory i ON i.id = st.inventory_id WHERE 1=1`;
  const args = [];
  if (inventoryId) { sql += ` AND st.inventory_id = ?`; args.push(inventoryId); }
  if (status) { sql += ` AND st.status = ?`; args.push(status); }
  sql += ` ORDER BY st.created_at DESC`;
  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] StockTransfers List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, transfers: rows || [] });
  });
}

function handleGet(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const id = getId(req);
  db.get(`SELECT st.*, i.name as inventory_name FROM stock_transfers st LEFT JOIN inventory i ON i.id = st.inventory_id WHERE st.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] StockTransfers Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Stock transfer not found.' });
    }
    return sendSecureJSON(res, 200, { ok: true, transfer: row });
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
      const { inventory_id, from_location, to_location, quantity, notes } = p;
      if (!inventory_id || !from_location || !to_location || !quantity || parseFloat(quantity) <= 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'inventory_id, from_location, to_location and a positive quantity are required.' });
      }
      const id = 'trf_' + Date.now();
      db.run(`INSERT INTO stock_transfers (id, inventory_id, from_location, to_location, quantity, status, notes, performed_by) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [id, inventory_id, from_location, to_location, quantity, notes || '', req.user.id || null],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] StockTransfer Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Transfer creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, transfer: { id, inventory_id, from_location, to_location, quantity, status: 'pending' } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleApprove(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const id = getId(req);
  db.get(`SELECT * FROM stock_transfers WHERE id = ?`, [id], (err, trf) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] StockTransfer Approve Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!trf) return sendSecureJSON(res, 404, { ok: false, error: 'Stock transfer not found.' });
    if (trf.status !== 'pending') {
      return sendSecureJSON(res, 400, { ok: false, error: 'Only pending transfers can be approved.' });
    }
    const adjId = 'adj_' + Date.now();
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', () => {
        db.run(`INSERT INTO stock_adjustments (id, inventory_id, adjustment_type, quantity_change, reason, reference_id, performed_by) VALUES (?, ?, 'transfer', ?, ?, ?, ?)`,
          [adjId, trf.inventory_id, trf.quantity, 'Transfer to ' + trf.to_location, id, req.user.id || null],
          function (aErr) {
            if (aErr) {
              db.run('ROLLBACK', () => {});
              console.error(`[SECURE EXCEPTION] StockTransfer Adj Trace: ${aErr.message}`);
              return sendSecureJSON(res, 500, { ok: false, error: 'Failed to record stock adjustment.' });
            }
            db.run(`UPDATE stock_transfers SET status = 'completed' WHERE id = ?`, [id], function (uErr) {
              if (uErr) {
                db.run('ROLLBACK', () => {});
                console.error(`[SECURE EXCEPTION] StockTransfer Complete Trace: ${uErr.message}`);
                return sendSecureJSON(res, 500, { ok: false, error: 'Failed to complete transfer.' });
              }
              db.run('COMMIT', () => sendSecureJSON(res, 200, { ok: true, transfer: { id, status: 'completed' } }));
            });
          });
      });
    });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleApprove };
