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
  const patientId = params.get('patient_id') || '';
  const unread = params.get('unread') || '';

  let sql = `SELECT n.id, n.patient_id, n.type, n.channel, n.subject, n.body, n.sent_at, n.read_at, n.sent_by, p.name as patient_name, emp.name as sender_name FROM notifications n LEFT JOIN patients p ON p.id = n.patient_id LEFT JOIN employees emp ON emp.id = n.sent_by WHERE 1=1`;
  const args = [];

  if (patientId) { sql += ` AND n.patient_id = ?`; args.push(patientId); }
  if (unread === 'true') { sql += ` AND n.read_at IS NULL`; }

  sql += ` ORDER BY n.sent_at DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Notifications List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, notifications: rows || [] });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT n.id, n.patient_id, n.type, n.channel, n.subject, n.body, n.sent_at, n.read_at, n.sent_by, p.name as patient_name, emp.name as sender_name FROM notifications n LEFT JOIN patients p ON p.id = n.patient_id LEFT JOIN employees emp ON emp.id = n.sent_by WHERE n.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Notification Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Notification not found' });
    return sendSecureJSON(res, 200, { ok: true, notification: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, type, channel, subject, body: noteBody, sent_by } = p;
      if (!patient_id || !type) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and type are required.' });
      }
      db.run(`INSERT INTO notifications (patient_id, type, channel, subject, body, sent_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [patient_id, type || 'reminder', channel || 'sms', subject || '', noteBody || '', sent_by || null],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Notification Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Notification creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, notification: { id: this.lastID, patient_id, type, subject } });
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
      const allowed = ['patient_id', 'type', 'channel', 'subject', 'body', 'read_at', 'sent_by'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE notifications SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Notification Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Notification not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM notifications WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Notification Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Notification not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
