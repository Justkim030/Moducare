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

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function handleList(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  const isAdmin = hasCapability(req.user.role_id, 'user:manage');
  const userId = getParam(req, 'user_id') || '';
  const date = getParam(req, 'date') || '';
  const month = getParam(req, 'month') || '';

  let sql = `SELECT * FROM time_attendance WHERE 1=1`;
  const args = [];

  if (!isAdmin) {
    sql += ` AND user_id = ?`;
    args.push(req.user.id);
  } else if (userId) {
    sql += ` AND user_id = ?`;
    args.push(userId);
  }

  if (date) { sql += ` AND date = ?`; args.push(date); }
  if (month) { sql += ` AND date LIKE ?`; args.push(month + '%'); }

  sql += ` ORDER BY date DESC, clock_in DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] TimeAttendance List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, attendance: rows || [] });
  });
}

function handleGet(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  const id = getId(req);
  db.get(`SELECT * FROM time_attendance WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] TimeAttendance Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Attendance record not found.' });
    }
    const isAdmin = hasCapability(req.user.role_id, 'user:manage');
    if (!isAdmin && row.user_id !== req.user.id) {
      return sendSecureJSON(res, 403, { ok: false, error: 'Insufficient permissions.' });
    }
    return sendSecureJSON(res, 200, { ok: true, record: row });
  });
}

function handleClockIn(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch (e) { p = {}; }
    const id = 'att_' + Date.now();
    const now = new Date();
    const clockIn = now.toISOString();
    const date = todayStr();
    const shift = p.shift || 'day';
    const userId = req.user.id;
    db.run(`INSERT INTO time_attendance (id, user_id, clock_in, date, shift, status, notes) VALUES (?, ?, ?, ?, ?, 'present', ?)`,
      [id, userId, clockIn, date, shift, p.notes || ''],
      function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Attendance ClockIn Trace: ${err.message}`);
          return sendSecureJSON(res, 400, { ok: false, error: 'Clock-in failed.' });
        }
        return sendSecureJSON(res, 201, { ok: true, record: { id, user_id: userId, clock_in: clockIn, date, shift, status: 'present' } });
      });
  });
}

function handleClockOut(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    let p = {};
    try { p = JSON.parse(body || '{}'); } catch (e) { p = {}; }
    const recordId = p.record_id || null;
    const date = todayStr();
    let lookupSql = `SELECT * FROM time_attendance WHERE user_id = ? AND date = ? AND clock_out IS NULL`;
    let lookupArgs = [req.user.id, date];
    if (recordId) {
      lookupSql = `SELECT * FROM time_attendance WHERE id = ? AND user_id = ?`;
      lookupArgs = [recordId, req.user.id];
    }
    db.get(lookupSql, lookupArgs, (err, rec) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Attendance ClockOut Lookup Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      if (!rec) {
        return sendSecureJSON(res, 404, { ok: false, error: 'No open attendance record found to clock out.' });
      }
      const now = new Date();
      const clockOut = now.toISOString();
      const start = new Date(rec.clock_in).getTime();
      let totalHours = 0;
      if (!isNaN(start)) {
        totalHours = (now.getTime() - start) / (1000 * 60 * 60);
        totalHours = Math.round(totalHours * 100) / 100;
      }
      db.run(`UPDATE time_attendance SET clock_out = ?, total_hours = ? WHERE id = ?`,
        [clockOut, totalHours, rec.id],
        function (uErr) {
          if (uErr) {
            console.error(`[SECURE EXCEPTION] Attendance ClockOut Trace: ${uErr.message}`);
            return sendSecureJSON(res, 500, { ok: false, error: 'Clock-out failed.' });
          }
          return sendSecureJSON(res, 200, { ok: true, record: { id: rec.id, clock_out: clockOut, total_hours: totalHours } });
        });
    });
  });
}

function handleCreate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: user:manage' });
  }
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { user_id, clock_in, clock_out, date, shift, status, notes } = p;
      if (!user_id || !date) {
        return sendSecureJSON(res, 400, { ok: false, error: 'user_id and date are required.' });
      }
      const id = 'att_' + Date.now();
      const totalHours = parseFloat(p.total_hours) || 0;
      db.run(`INSERT INTO time_attendance (id, user_id, clock_in, clock_out, date, shift, total_hours, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user_id, clock_in || null, clock_out || null, date, shift || 'day', totalHours, status || 'present', notes || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Attendance Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Manual entry failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, record: { id, user_id, date } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: user:manage' });
  }
  const id = getId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['notes', 'status', 'shift', 'clock_in', 'clock_out', 'total_hours'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE time_attendance SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Attendance Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Record not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

module.exports = { handleList, handleGet, handleClockIn, handleClockOut, handleCreate, handleUpdate };
