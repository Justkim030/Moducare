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

function getPoId(req) {
  const parts = req.url.split('/');
  return parts[parts.length - 1];
}

function getPoIdNested(req) {
  const parts = req.url.split('/');
  return parts[parts.length - 2];
}

function computeTotal(items) {
  let total = 0;
  for (const it of items) {
    const qty = parseFloat(it.quantity) || 0;
    const cost = parseFloat(it.unit_cost) || 0;
    total += qty * cost;
  }
  return total;
}

function handleList(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const status = getParam(req, 'status') || '';
  const supplierId = getParam(req, 'supplier_id') || '';

  let sql = `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE 1=1`;
  const args = [];
  if (status) { sql += ` AND po.status = ?`; args.push(status); }
  if (supplierId) { sql += ` AND po.supplier_id = ?`; args.push(supplierId); }
  sql += ` ORDER BY po.created_at DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] PurchaseOrders List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, purchase_orders: rows || [] });
  });
}

function handleGet(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:read' });
  }
  const id = getPoId(req);
  db.get(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`, [id], (err, po) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] PurchaseOrders Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!po) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Purchase order not found.' });
    }
    db.all(`SELECT * FROM purchase_order_items WHERE po_id = ?`, [id], (err2, items) => {
      if (err2) {
        console.error(`[SECURE EXCEPTION] PurchaseOrders Items Error: ${err2.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      po.items = items || [];
      return sendSecureJSON(res, 200, { ok: true, purchase_order: po });
    });
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
      const { supplier_id, items, notes } = p;
      const poId = 'po_' + Date.now();
      const poNumber = p.po_number || ('PO-' + Date.now());
      const parsedItems = Array.isArray(items) ? items : [];
      const total = computeTotal(parsedItems);
      const requestedBy = req.user.id || null;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error(`[SECURE EXCEPTION] PO Create Begin Error: ${err.message}`);
            return sendSecureJSON(res, 500, { ok: false, error: 'Transaction failed.' });
          }

          db.run(`INSERT INTO purchase_orders (id, supplier_id, po_number, status, total_amount, notes, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [poId, supplier_id || null, poNumber, 'draft', total, notes || '', requestedBy],
            function (err) {
              if (err) {
                db.run('ROLLBACK', () => {});
                console.error(`[SECURE EXCEPTION] PO Create Trace: ${err.message}`);
                return sendSecureJSON(res, 400, { ok: false, error: 'Purchase order creation failed.' });
              }

              if (parsedItems.length === 0) {
                return db.run('COMMIT', (cErr) => {
                  if (cErr) {
                    console.error(`[SECURE EXCEPTION] PO Commit Error: ${cErr.message}`);
                    return sendSecureJSON(res, 500, { ok: false, error: 'Transaction failed.' });
                  }
                  return sendSecureJSON(res, 201, { ok: true, purchase_order: { id: poId, po_number: poNumber, status: 'draft', total_amount: total } });
                });
              }

              let pending = parsedItems.length;
              let failed = false;
              parsedItems.forEach((it) => {
                const itemId = 'soi_' + Date.now() + '_' + pending;
                db.run(`INSERT INTO purchase_order_items (id, po_id, inventory_id, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)`,
                  [itemId, poId, it.inventory_id || null, it.quantity || 0, it.unit_cost || 0],
                  function (iErr) {
                    if (iErr && !failed) {
                      failed = true;
                      db.run('ROLLBACK', () => {});
                      console.error(`[SECURE EXCEPTION] PO Item Trace: ${iErr.message}`);
                      return sendSecureJSON(res, 400, { ok: false, error: 'Failed to create purchase order items.' });
                    }
                    pending -= 1;
                    if (pending === 0 && !failed) {
                      db.run('COMMIT', (cErr) => {
                        if (cErr) {
                          console.error(`[SECURE EXCEPTION] PO Commit Error: ${cErr.message}`);
                          return sendSecureJSON(res, 500, { ok: false, error: 'Transaction failed.' });
                        }
                        return sendSecureJSON(res, 201, { ok: true, purchase_order: { id: poId, po_number: poNumber, status: 'draft', total_amount: total } });
                      });
                    }
                  });
              });
            });
        });
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
  const id = getPoId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['supplier_id', 'status', 'notes', 'total_amount'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      fields.push(`updated_at = datetime('now')`);
      if (fields.length === 1) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] PO Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Purchase order not found.' });
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
  const id = getPoId(req);
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', () => {
      db.run(`DELETE FROM purchase_order_items WHERE po_id = ?`, [id], (err) => {
        if (err) {
          db.run('ROLLBACK', () => {});
          console.error(`[SECURE EXCEPTION] PO Item Delete Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
        }
        db.run(`DELETE FROM purchase_orders WHERE id = ?`, [id], function (err2) {
          if (err2) {
            db.run('ROLLBACK', () => {});
            console.error(`[SECURE EXCEPTION] PO Delete Trace: ${err2.message}`);
            return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
          }
          if (this.changes === 0) {
            return sendSecureJSON(res, 404, { ok: false, error: 'Purchase order not found.' });
          }
          db.run('COMMIT', () => sendSecureJSON(res, 200, { ok: true }));
        });
      });
    });
  });
}

function handleAddItem(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const id = getPoIdNested(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { inventory_id, quantity, unit_cost } = p;
      if (!quantity || parseFloat(quantity) <= 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Item quantity is required.' });
      }
      const itemId = 'soi_' + Date.now();
      db.run(`INSERT INTO purchase_order_items (id, po_id, inventory_id, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)`,
        [itemId, id, inventory_id || null, quantity, unit_cost || 0],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] PO AddItem Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Failed to add item.' });
          }
          return sendSecureJSON(res, 201, { ok: true, item: { id: itemId, po_id: id, inventory_id, quantity, unit_cost: unit_cost || 0 } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdateItem(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const itemId = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['inventory_id', 'quantity', 'unit_cost'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(itemId);
      db.run(`UPDATE purchase_order_items SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] PO UpdateItem Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Item not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDeleteItem(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const itemId = req.url.split('/').pop();
  db.run(`DELETE FROM purchase_order_items WHERE id = ?`, [itemId], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] PO DeleteItem Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Item not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

function handleApprove(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'inventory:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: inventory:write' });
  }
  const id = getPoIdNested(req);
  db.get(`SELECT status FROM purchase_orders WHERE id = ?`, [id], (err, po) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] PO Approve Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!po) return sendSecureJSON(res, 404, { ok: false, error: 'Purchase order not found.' });
    if (po.status !== 'draft') {
      return sendSecureJSON(res, 400, { ok: false, error: 'Only draft purchase orders can be approved.' });
    }
    db.run(`UPDATE purchase_orders SET status = 'approved', approved_by = ?, updated_at = datetime('now') WHERE id = ?`,
      [req.user.id || null, id],
      function (err2) {
        if (err2) {
          console.error(`[SECURE EXCEPTION] PO Approve Trace: ${err2.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Approval failed.' });
        }
        return sendSecureJSON(res, 200, { ok: true, purchase_order: { id, status: 'approved', approved_by: req.user.id || null } });
      });
  });
}

module.exports = {
  handleList,
  handleGet,
  handleCreate,
  handleUpdate,
  handleDelete,
  handleAddItem,
  handleUpdateItem,
  handleDeleteItem,
  handleApprove
};
