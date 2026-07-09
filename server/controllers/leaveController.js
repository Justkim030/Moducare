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

function computeDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

function handleList(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  const isAdmin = hasCapability(req.user.role_id, 'user:manage');
  const userId = getParam(req, 'user_id') || '';
  const status = getParam(req, 'status') || '';

  let sql = `SELECT * FROM leave_requests WHERE 1=1`;
  const args = [];

  if (!isAdmin) {
    sql += ` AND user_id = ?`;
    args.push(req.user.id);
  } else if (userId) {
    sql += ` AND user_id = ?`;
    args.push(userId);
  }

  if (status) { sql += ` AND status = ?`; args.push(status); }
  sql += ` ORDER BY created_at DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Leave List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, leave_requests: rows || [] });
  });
}

function handleGet(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  const id = getId(req);
  db.get(`SELECT * FROM leave_requests WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Leave Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Leave request not found.' });
    }
    const isAdmin = hasCapability(req.user.role_id, 'user:manage');
    if (!isAdmin && row.user_id !== req.user.id) {
      return sendSecureJSON(res, 403, { ok: false, error: 'Insufficient permissions.' });
    }
    return sendSecureJSON(res, 200, { ok: true, leave_request: row });
  });
}

function handleCreate(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { leave_type, start_date, end_date, reason } = p;
      if (!leave_type || !start_date || !end_date) {
        return sendSecureJSON(res, 400, { ok: false, error: 'leave_type, start_date and end_date are required.' });
      }
      const id = 'lv_' + Date.now();
      const daysCount = p.days_count !== undefined ? parseFloat(p.days_count) : computeDays(start_date, end_date);
      db.run(`INSERT INTO leave_requests (id, user_id, leave_type, start_date, end_date, days_count, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, req.user.id, leave_type, start_date, end_date, daysCount, reason || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Leave Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Leave request creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, leave_request: { id, user_id: req.user.id, leave_type, start_date, end_date, days_count: daysCount, status: 'pending' } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleApprove(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: user:manage' });
  }
  const id = getId(req);
  db.get(`SELECT * FROM leave_requests WHERE id = ?`, [id], (err, reqRow) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Leave Approve Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!reqRow) return sendSecureJSON(res, 404, { ok: false, error: 'Leave request not found.' });
    if (reqRow.status !== 'pending') {
      return sendSecureJSON(res, 400, { ok: false, error: 'Only pending requests can be approved.' });
    }
    db.run(`UPDATE leave_requests SET status = 'approved', approved_by = ?, updated_at = datetime('now') WHERE id = ?`,
      [req.user.id, id],
      function (uErr) {
        if (uErr) {
          console.error(`[SECURE EXCEPTION] Leave Approve Trace: ${uErr.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Approval failed.' });
        }
        return sendSecureJSON(res, 200, { ok: true, leave_request: { id, status: 'approved', approved_by: req.user.id } });
      });
  });
}

function handleReject(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: user:manage' });
  }
  const id = getId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch (e) { p = {}; }
    db.get(`SELECT * FROM leave_requests WHERE id = ?`, [id], (err, reqRow) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Leave Reject Detail Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      if (!reqRow) return sendSecureJSON(res, 404, { ok: false, error: 'Leave request not found.' });
      if (reqRow.status !== 'pending') {
        return sendSecureJSON(res, 400, { ok: false, error: 'Only pending requests can be rejected.' });
      }
      db.run(`UPDATE leave_requests SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`,
        [p.rejection_reason || '', id],
        function (uErr) {
          if (uErr) {
            console.error(`[SECURE EXCEPTION] Leave Reject Trace: ${uErr.message}`);
            return sendSecureJSON(res, 500, { ok: false, error: 'Rejection failed.' });
          }
          return sendSecureJSON(res, 200, { ok: true, leave_request: { id, status: 'rejected', rejection_reason: p.rejection_reason || '' } });
        });
    });
  });
}

function handleUpdate(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  const id = getId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      db.get(`SELECT * FROM leave_requests WHERE id = ?`, [id], (err, reqRow) => {
        if (err) {
          console.error(`[SECURE EXCEPTION] Leave Update Detail Error: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
        }
        if (!reqRow) return sendSecureJSON(res, 404, { ok: false, error: 'Leave request not found.' });
        const isAdmin = hasCapability(req.user.role_id, 'user:manage');
        if (!isAdmin && reqRow.user_id !== req.user.id) {
          return sendSecureJSON(res, 403, { ok: false, error: 'Insufficient permissions.' });
        }
        if (reqRow.status !== 'pending') {
          return sendSecureJSON(res, 400, { ok: false, error: 'Only pending requests can be updated.' });
        }
        const fields = [];
        const values = [];
        const allowed = ['leave_type', 'start_date', 'end_date', 'reason'];
        allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
        if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
        fields.push(`updated_at = datetime('now')`);
        values.push(id);
        db.run(`UPDATE leave_requests SET ${fields.join(', ')} WHERE id = ?`, values, function (uErr) {
          if (uErr) {
            console.error(`[SECURE EXCEPTION] Leave Update Trace: ${uErr.message}`);
            return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
          }
          return sendSecureJSON(res, 200, { ok: true });
        });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  const id = getId(req);
  db.get(`SELECT * FROM leave_requests WHERE id = ?`, [id], (err, reqRow) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Leave Delete Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!reqRow) return sendSecureJSON(res, 404, { ok: false, error: 'Leave request not found.' });
    const isAdmin = hasCapability(req.user.role_id, 'user:manage');
    if (!isAdmin && reqRow.user_id !== req.user.id) {
      return sendSecureJSON(res, 403, { ok: false, error: 'Insufficient permissions.' });
    }
    if (reqRow.status !== 'pending') {
      return sendSecureJSON(res, 400, { ok: false, error: 'Only pending requests can be deleted.' });
    }
    db.run(`DELETE FROM leave_requests WHERE id = ?`, [id], function (dErr) {
      if (dErr) {
        console.error(`[SECURE EXCEPTION] Leave Delete Trace: ${dErr.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
      }
      return sendSecureJSON(res, 200, { ok: true });
    });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleApprove, handleReject, handleUpdate, handleDelete };
