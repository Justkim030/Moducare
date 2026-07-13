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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'patient:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const patientId = params.get('patient_id') || '';
  const direction = params.get('direction') || '';
  const page = parseInt(params.get('page')) || 1;
  const limit = Math.min(Math.max(parseInt(params.get('limit')) || 25, 1), 100);
  const offset = (page - 1) * limit;

  let sql = `SELECT r.id, r.patient_id, r.from_facility, r.to_facility, r.reason, r.status, r.requested_at, r.completed_at, r.requested_by, p.name as patient_name, emp.name as requester_name FROM referrals r LEFT JOIN patients p ON p.id = r.patient_id LEFT JOIN employees emp ON emp.id = r.requested_by WHERE 1=1`;
  const args = [];

  if (patientId) { sql += ` AND r.patient_id = ?`; args.push(patientId); }
  if (direction) { sql += ` AND r.direction = ?`; args.push(direction); }

  let countSql = `SELECT COUNT(*) as total FROM referrals r WHERE 1=1`;
  const countArgs = [];
  if (patientId) { countSql += ` AND r.patient_id = ?`; countArgs.push(patientId); }
  if (direction) { countSql += ` AND r.direction = ?`; countArgs.push(direction); }

  sql += ` ORDER BY r.requested_at DESC LIMIT ? OFFSET ?`;

  db.get(countSql, countArgs, (err, countRow) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Referrals List Count Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    db.all(sql, [...args, limit, offset], (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Referrals List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, { ok: true, data: rows || [], pagination: { page: page, limit: limit, total: total, totalPages: totalPages } });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'patient:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get(`SELECT r.id, r.patient_id, r.from_facility, r.to_facility, r.reason, r.status, r.requested_at, r.completed_at, r.requested_by, p.name as patient_name, emp.name as requester_name FROM referrals r LEFT JOIN patients p ON p.id = r.patient_id LEFT JOIN employees emp ON emp.id = r.requested_by WHERE r.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Referral Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Referral not found' });
    return sendSecureJSON(res, 200, { ok: true, referral: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'referral:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, from_facility, to_facility, reason, request_type, status, requested_by } = p;
      if (!patient_id || !to_facility) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and destination facility are required.' });
      }
      db.run(`INSERT INTO referrals (patient_id, from_facility, to_facility, reason, request_type, status, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, from_facility || '', to_facility, reason || '', request_type || 'referral', status || 'pending', requested_by || null],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Referral Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Referral creation failed.' });
          }
          const refId = this.lastID;
          db.run(`INSERT INTO audit (user_id, action, details, resource_type, status) VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, 'create_referral', `Created referral for patient ${patient_id} to ${to_facility}`, 'referral', 'success'],
            function (auditErr) {
              if (auditErr) {
                console.error(`[AUDIT] Log failed: ${auditErr.message}`);
              }
              return sendSecureJSON(res, 201, { ok: true, referral: { id: refId, patient_id, to_facility, status } });
            }
          );
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'referral:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['patient_id', 'from_facility', 'to_facility', 'reason', 'request_type', 'status', 'completed_at', 'requested_by'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE referrals SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Referral Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Referral not found.' });
        db.run(`INSERT INTO audit (user_id, action, details, resource_type, status) VALUES (?, ?, ?, ?, ?)`,
          [req.user.id, 'update_referral', `Updated referral ${id}`, 'referral', 'success'],
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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'referral:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run(`DELETE FROM referrals WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Referral Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Referral not found.' });
    db.run(`INSERT INTO audit (user_id, action, details, resource_type, status) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'delete_referral', `Deleted referral ${id}`, 'referral', 'success'],
      function (auditErr) {
        if (auditErr) {
          console.error(`[AUDIT] Log failed: ${auditErr.message}`);
        }
        return sendSecureJSON(res, 200, { ok: true });
      }
    );
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
