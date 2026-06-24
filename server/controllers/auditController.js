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
  const action = params.get('action') || '';

  let sql = `SELECT a.id, a.user_id, a.action, a.details, a.resource_type, a.resource_id, a.status, a.ip_address, a.user_agent, a.timestamp FROM audit a WHERE 1=1`;
  const args = [];

  if (action) { sql += ` AND a.action = ?`; args.push(action); }

  sql += ` ORDER BY a.timestamp DESC LIMIT 500`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Audit List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, audit: rows || [] });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { user_id, action, details, resource_type, resource_id, status, ip_address, user_agent } = p;
      db.run(`INSERT INTO audit (user_id, action, details, resource_type, resource_id, status, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id || null, action || 'unknown', details || '', resource_type || '', resource_id || null, status || 'success', ip_address || '', user_agent || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Audit Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Audit log creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, audit: { id: this.lastID } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

module.exports = { handleList, handleCreate };
