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
  const search = params.get('search') || '';
  const department = params.get('department') || '';
  const status = params.get('status') || '';
  const role = params.get('role') || '';
  const { page, limit, offset } = parsePagination(params);

  const whereClauses = [];
  const args = [];
  if (search) {
    whereClauses.push(`(e.name LIKE ? OR u.email LIKE ? OR ep.position LIKE ?)`);
    args.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
  }
  if (department) {
    whereClauses.push(`(d.id = ? OR d.name LIKE ?)`);
    args.push(department, '%' + department + '%');
  }
  if (status) { whereClauses.push(`ep.status = ?`); args.push(status); }
  if (role) { whereClauses.push(`r.id = ?`); args.push(role); }

  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(DISTINCT e.id) as total FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id${whereSql}`;

  db.get(countSql, args, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Employees List Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }

    const dataSql = `SELECT e.id, e.name, u.email, u.phone_number as phone, r.name as role, r.id as role_id, d.name as department, d.id as department_id, ep.position, ep.employment_type, ep.status, ep.hire_date, ep.salary FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id${whereSql} ORDER BY e.name ASC LIMIT ? OFFSET ?`;
    const dataArgs = args.concat([limit, offset]);

    db.all(dataSql, dataArgs, (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Employees List Error: ${err.message}`);
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
  const empSql = `SELECT e.id, e.name, u.email, u.phone_number as phone, r.name as role, r.id as role_id, d.name as department, d.id as department_id FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id WHERE e.id = ?`;

  db.get(empSql, [id], (err, emp) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Employee Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!emp) return sendSecureJSON(res, 404, { ok: false, error: 'Employee not found' });

    db.get(`SELECT * FROM employee_profiles WHERE employee_id = ?`, [id], (pErr, profile) => {
      if (pErr) {
        console.error(`[SECURE EXCEPTION] Employee Profile Error: ${pErr.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }

      db.all(`SELECT * FROM contracts WHERE employee_id = ? ORDER BY start_date DESC`, [id], (cErr, contracts) => {
        if (cErr) {
          console.error(`[SECURE EXCEPTION] Employee Contracts Error: ${cErr.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
        }

        db.all(`SELECT * FROM training_records WHERE employee_id = ? ORDER BY start_date DESC`, [id], (tErr, training) => {
          if (tErr) {
            console.error(`[SECURE EXCEPTION] Employee Training Error: ${tErr.message}`);
            return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
          }

          db.all(`SELECT * FROM performance_reviews WHERE employee_id = ? ORDER BY review_period DESC`, [id], (prErr, performance) => {
            if (prErr) {
              console.error(`[SECURE EXCEPTION] Employee Performance Error: ${prErr.message}`);
              return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
            }

            db.all(`SELECT id, pay_period_start, pay_period_end, basic_salary, net_pay, status, paid_at FROM payroll_records WHERE employee_id = ? ORDER BY pay_period_end DESC`, [id], (payErr, payroll) => {
              if (payErr) {
                console.error(`[SECURE EXCEPTION] Employee Payroll Error: ${payErr.message}`);
                return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
              }

              return sendSecureJSON(res, 200, {
                ok: true,
                data: {
                  employee: emp,
                  profile: profile || null,
                  contracts: contracts || [],
                  training: training || [],
                  performance: performance || [],
                  payroll: payroll || []
                }
              });
            });
          });
        });
      });
    });
  });
}

function handleUpdateProfile(req, res) {
  const id = getPathId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');

      if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'staff:read')) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }
      const isWrite = hasCapability(req.user.role_id, 'user:manage');
      const canRead = hasCapability(req.user.role_id, 'staff:read');
      if (!canRead || !isWrite) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }

      const fields = [];
      const values = [];
      const allowed = ['position', 'department_id', 'employment_type', 'salary', 'emergency_contact', 'emergency_phone', 'status'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });

      if (fields.length === 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      }

      fields.push(`updated_at = datetime('now')`);
      values.push(id);

      db.run(`UPDATE employee_profiles SET ${fields.join(', ')} WHERE employee_id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Employee Profile Update Trace: ${err.message}`);
          logAudit(getUserId(req), 'update_employee_profile', `Failed to update profile ${id}`, 'employee', id, 'failed');
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Employee profile not found.' });
        }
        logAudit(getUserId(req), 'update_employee_profile', `Updated profile ${id}`, 'employee', id, 'success');
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Employee Profile Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdateStatus(req, res) {
  const id = getPathId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'user:manage')) {
        return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
      }

      const p = JSON.parse(body || '{}');
      const status = p.status;
      const valid = ['active', 'inactive', 'suspended', 'terminated'];
      if (!status || valid.indexOf(status) === -1) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Valid status (active|inactive|suspended|terminated) is required.' });
      }

      db.serialize(() => {
        db.run(`UPDATE employee_profiles SET status = ?, updated_at = datetime('now') WHERE employee_id = ?`, [status, id], function (e2) {
          if (e2) {
            console.error(`[SECURE EXCEPTION] Employee Profile Status Trace: ${e2.message}`);
            logAudit(getUserId(req), 'update_employee_status', `Failed to update profile status ${id}`, 'employee', id, 'failed');
            return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
          }
          logAudit(getUserId(req), 'update_employee_status', `Updated status to ${status} for ${id}`, 'employee', id, 'success');
          return sendSecureJSON(res, 200, { ok: true });
        });
      });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Employee Status Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

module.exports = {
  handleList,
  handleGet,
  handleUpdateProfile,
  handleUpdateStatus
};
