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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);

  const page = parseInt(params.get('page')) || 1;
  const limit = Math.min(Math.max(parseInt(params.get('limit')) || 25, 1), 100);
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*) as total FROM activities`;

  db.get(countSql, (err, countRow) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Activities List Count Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const sql = `SELECT id, time, employee_id, action, details, priority, due, status FROM activities ORDER BY time DESC LIMIT ? OFFSET ?`;
    db.all(sql, [limit, offset], (err2, rows) => {
      if (err2) {
        console.error(`[SECURE EXCEPTION] Activities List Error: ${err2.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, { ok: true, data: rows || [], pagination: { page: page, limit: limit, total: total, totalPages: totalPages } });
    });
  });
}

module.exports = { handleList };
