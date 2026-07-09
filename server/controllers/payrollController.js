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

function getUserId(req) {
  return (req && req.user && req.user.id) ? req.user.id : null;
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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'staff:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const employeeId = params.get('employee_id') || '';
  const status = params.get('status') || '';
  const payPeriodStart = params.get('pay_period_start') || '';
  const payPeriodEnd = params.get('pay_period_end') || '';
  const { page, limit, offset } = parsePagination(params);

  const whereClauses = [];
  const args = [];
  if (employeeId) { whereClauses.push(`p.employee_id = ?`); args.push(employeeId); }
  if (status) { whereClauses.push(`p.status = ?`); args.push(status); }
  if (payPeriodStart) { whereClauses.push(`p.pay_period_start = ?`); args.push(payPeriodStart); }
  if (payPeriodEnd) { whereClauses.push(`p.pay_period_end = ?`); args.push(payPeriodEnd); }
  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM payroll_records p LEFT JOIN employees e ON e.id = p.employee_id${whereSql}`;

  db.get(countSql, args, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Payroll List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    const dataSql = `SELECT p.id, p.employee_id, e.name as employee_name, p.pay_period_start, p.pay_period_end, p.basic_salary, p.allowances, p.deductions, p.net_pay, p.status, p.paid_at FROM payroll_records p LEFT JOIN employees e ON e.id = p.employee_id${whereSql} ORDER BY p.pay_period_end DESC LIMIT ? OFFSET ?`;
    const dataArgs = args.concat([limit, offset]);

    db.all(dataSql, dataArgs, (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Payroll List Error: ${err.message}`);
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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'staff:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = getPathId(req);
  const sql = `SELECT p.*, e.name as employee_name, e.role_id, e.department_id FROM payroll_records p LEFT JOIN employees e ON e.id = p.employee_id WHERE p.id = ?`;

  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Payroll Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Payroll record not found' });
    return sendSecureJSON(res, 200, { ok: true, data: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }

      const p = JSON.parse(body || '{}');
      const { employee_id, pay_period_start, pay_period_end, basic_salary, allowances, deductions, net_pay, status } = p;

      if (!employee_id || !pay_period_start || !pay_period_end) {
        return sendSecureJSON(res, 400, { ok: false, error: 'employee_id, pay_period_start and pay_period_end are required.' });
      }

      const id = 'pay_' + Date.now();
      const payStatus = status || 'pending';

      db.run(`INSERT INTO payroll_records (id, employee_id, pay_period_start, pay_period_end, basic_salary, allowances, deductions, net_pay, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, employee_id, pay_period_start, pay_period_end, basic_salary || 0, allowances || 0, deductions || 0, net_pay || 0, payStatus],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Payroll Create Trace: ${err.message}`);
            logAudit(getUserId(req), 'create_payroll', `Failed to create payroll for ${employee_id}`, 'payroll', id, 'failed');
            return sendSecureJSON(res, 400, { ok: false, error: 'Payroll creation failed.' });
          }
          logAudit(getUserId(req), 'create_payroll', `Created payroll ${id} for ${employee_id}`, 'payroll', id, 'success');
          return sendSecureJSON(res, 201, { ok: true, data: { id: id, employee_id: employee_id, pay_period_start: pay_period_start, pay_period_end: pay_period_end, status: payStatus } });
        });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Payroll Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  const id = getPathId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }

      const p = JSON.parse(body || '{}');
      const fields = [];
      const values = [];
      const allowed = ['employee_id', 'pay_period_start', 'pay_period_end', 'basic_salary', 'allowances', 'deductions', 'net_pay', 'status'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });

      values.push(id);
      db.run(`UPDATE payroll_records SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Payroll Update Trace: ${err.message}`);
          logAudit(getUserId(req), 'update_payroll', `Failed to update payroll ${id}`, 'payroll', id, 'failed');
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Payroll record not found.' });
        logAudit(getUserId(req), 'update_payroll', `Updated payroll ${id}`, 'payroll', id, 'success');
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Payroll Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleMarkPaid(req, res) {
  const id = getPathId(req);
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  db.run(`UPDATE payroll_records SET status = 'paid', paid_at = datetime('now') WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Payroll Mark Paid Trace: ${err.message}`);
      logAudit(getUserId(req), 'mark_payroll_paid', `Failed to mark payroll ${id} paid`, 'payroll', id, 'failed');
      return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Payroll record not found.' });
    logAudit(getUserId(req), 'mark_payroll_paid', `Marked payroll ${id} paid`, 'payroll', id, 'success');
    return sendSecureJSON(res, 200, { ok: true });
  });
}

function handleDelete(req, res) {
  const id = getPathId(req);
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  db.run(`DELETE FROM payroll_records WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Payroll Delete Trace: ${err.message}`);
      logAudit(getUserId(req), 'delete_payroll', `Failed to delete payroll ${id}`, 'payroll', id, 'failed');
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Payroll record not found.' });
    logAudit(getUserId(req), 'delete_payroll', `Deleted payroll ${id}`, 'payroll', id, 'success');
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = {
  handleList,
  handleGet,
  handleCreate,
  handleUpdate,
  handleMarkPaid,
  handleDelete
};
