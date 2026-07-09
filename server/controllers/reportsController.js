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

function logAudit(userId, action, details, resourceType, resourceId, status) {
  db.run(
    `INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, details, resourceType, resourceId ? resourceId : null, status],
    (err) => {
      if (err) console.error(`[AUDIT] Log failed: ${err.message}`);
    }
  );
}

function parsePagination(params) {
  let page = parseInt(params.get('page') || '1', 10);
  if (isNaN(page) || page < 1) page = 1;
  let limit = parseInt(params.get('limit') || '25', 10);
  if (isNaN(limit) || limit < 1) limit = 25;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;
  return { page: page, limit: limit, offset: offset };
}

function getPathId(req) {
  const segs = req.url.split('?')[0].split('/').filter(Boolean);
  return segs[2] || '';
}

function handleList(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const { page, limit, offset } = parsePagination(params);

  const countSql = `SELECT COUNT(*) as total FROM reports WHERE 1=1`;
  const dataSql = `SELECT * FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const dataArgs = [limit, offset];

  db.get(countSql, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Reports List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    db.all(dataSql, dataArgs, (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Reports List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const total = countRow ? countRow.total : 0;
      const totalPages = Math.ceil(total / limit);
      return sendSecureJSON(res, 200, {
        ok: true,
        data: rows || [],
        pagination: { page: page, limit: limit, total: total, totalPages: totalPages }
      });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = getPathId(req);
  db.get(`SELECT * FROM reports WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Report Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Report not found' });
    return sendSecureJSON(res, 200, { ok: true, data: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { name, source, columns, filters, sort, limit, schedule, recipients } = p;

      if (!name || !source) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Name and source are required.' });
      }

      const id = 'rpt_' + Date.now();
      const now = new Date().toISOString();

      db.run(`INSERT INTO reports (id, name, source, columns, filters, sort, limit, schedule, recipients, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, source, JSON.stringify(columns || []), JSON.stringify(filters || {}), sort || '', limit || 100, schedule || '', recipients || '', req.user.id, now],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Report Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Report creation failed.' });
          }
          logAudit(req.user.id, 'create_report', `Created report: ${name}`, 'report', id, 'success');
          return sendSecureJSON(res, 201, { ok: true, data: { id, name, source, created_at: now } });
        });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Report Create Malformed: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleScheduled(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const { page, limit, offset } = parsePagination(params);

  const countSql = `SELECT COUNT(*) as total FROM reports WHERE schedule IS NOT NULL AND schedule != ''`;
  const dataSql = `SELECT * FROM reports WHERE schedule IS NOT NULL AND schedule != '' ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const dataArgs = [limit, offset];

  db.get(countSql, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Scheduled Reports Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    db.all(dataSql, dataArgs, (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Scheduled Reports Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const total = countRow ? countRow.total : 0;
      const totalPages = Math.ceil(total / limit);
      return sendSecureJSON(res, 200, {
        ok: true,
        data: rows || [],
        pagination: { page: page, limit: limit, total: total, totalPages: totalPages }
      });
    });
  });
}

function handleRunScheduled(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = getPathId(req);
  db.get(`SELECT * FROM reports WHERE id = ?`, [id], (err, report) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Run Scheduled Report Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!report) return sendSecureJSON(res, 404, { ok: false, error: 'Report not found' });

    const source = report.source;
    const columns = JSON.parse(report.columns || '[]');
    const filters = JSON.parse(report.filters || '{}');
    const sort = report.sort || '';
    const limit = report.limit || 100;

    let sql = `SELECT ${columns.length > 0 ? columns.join(',') : '*'} FROM ${source}`;
    const args = [];
    const whereClauses = [];

    for (const [key, val] of Object.entries(filters)) {
      whereClauses.push(`${key} = ?`);
      args.push(val);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (sort) {
      sql += ` ORDER BY ${sort}`;
    }

    sql += ` LIMIT ?`;
    args.push(limit);

    db.all(sql, args, (queryErr, rows) => {
      if (queryErr) {
        console.error(`[SECURE EXCEPTION] Run Scheduled Report Query Error: ${queryErr.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Query failed.' });
      }
      logAudit(req.user.id, 'run_scheduled_report', `Ran report: ${report.name}`, 'report', id, 'success');
      return sendSecureJSON(res, 200, { ok: true, data: rows || [] });
    });
  });
}

function handleDelete(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = getPathId(req);
  db.run(`DELETE FROM reports WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Report Delete Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Report not found.' });
    logAudit(req.user.id, 'delete_report', `Deleted report ${id}`, 'report', id, 'success');
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = {
  handleList,
  handleGet,
  handleCreate,
  handleScheduled,
  handleRunScheduled,
  handleDelete
};
