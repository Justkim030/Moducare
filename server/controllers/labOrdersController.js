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

function logAudit(userId, action, details, resourceType, status, resourceId) {
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

function handleList(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'lab:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const patientId = params.get('patient_id') || '';
  const status = params.get('status') || '';
  const testType = params.get('test_type') || '';
  const { page, limit, offset } = parsePagination(params);

  const whereClauses = [];
  const args = [];
  if (patientId) { whereClauses.push(`lo.patient_id = ?`); args.push(patientId); }
  if (status) { whereClauses.push(`lo.status = ?`); args.push(status); }
  if (testType) { whereClauses.push(`lo.test_type = ?`); args.push(testType); }
  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(DISTINCT lo.id) as total FROM lab_orders lo LEFT JOIN patients p ON p.id = lo.patient_id LEFT JOIN employees emp ON emp.id = lo.ordering_provider_id${whereSql}`;

  db.get(countSql, args, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Lab Orders Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit);

    const dataSql = `SELECT lo.id, lo.patient_id, lo.encounter_id, lo.test_type, lo.test_name, lo.status, lo.result_value, lo.result_unit, lo.reference_range, lo.abnormal_flag, lo.result_date, lo.ordering_provider_id, lo.notes, p.name as patient_name, emp.name as provider_name FROM lab_orders lo LEFT JOIN patients p ON p.id = lo.patient_id LEFT JOIN employees emp ON emp.id = lo.ordering_provider_id${whereSql} ORDER BY lo.result_date DESC LIMIT ? OFFSET ?`;

    db.all(dataSql, args.concat([limit, offset]), (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Lab Orders List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, { ok: true, labOrders: rows || [], pagination: { page, limit, total, totalPages } });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'lab:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get(`SELECT lo.id, lo.patient_id, lo.encounter_id, lo.test_type, lo.test_name, lo.status, lo.result_value, lo.result_unit, lo.reference_range, lo.abnormal_flag, lo.result_date, lo.ordering_provider_id, lo.notes, p.name as patient_name, emp.name as provider_name FROM lab_orders lo LEFT JOIN patients p ON p.id = lo.patient_id LEFT JOIN employees emp ON emp.id = lo.ordering_provider_id WHERE lo.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Lab Order Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Lab order not found' });
    const userId = getUserId(req);
    db.run(`INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, 'view_lab', ?, 'lab_order', ?, 'success')`, [userId, `Viewed lab order ${id} for patient ${row.patient_id}`, id], () => {});
    return sendSecureJSON(res, 200, { ok: true, labOrder: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'lab:order')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, encounter_id, test_type, test_name, status, result_value, result_unit, reference_range, abnormal_flag, result_date, ordering_provider_id, notes } = p;
      if (!patient_id || !test_type) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and test type are required.' });
      }
      db.run(`INSERT INTO lab_orders (patient_id, encounter_id, test_type, test_name, status, result_value, result_unit, reference_range, abnormal_flag, result_date, ordering_provider_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, encounter_id || null, test_type, test_name || '', status || 'ordered', result_value || '', result_unit || '', reference_range || '', abnormal_flag || '', result_date || '', ordering_provider_id || null, notes || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Lab Order Create Trace: ${err.message}`);
            logAudit(getUserId(req), 'create_lab_order', `Failed to create lab order for patient ${patient_id}`, 'lab_order', 'failed', null);
            return sendSecureJSON(res, 400, { ok: false, error: 'Lab order creation failed.' });
          }
          const newId = this.lastID;
          logAudit(getUserId(req), 'create_lab_order', `Created lab order ${newId} for patient ${patient_id}`, 'lab_order', 'success', newId);
          return sendSecureJSON(res, 201, { ok: true, labOrder: { id: newId, patient_id, test_type, test_name, status } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'lab:result_entry')) {
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
      const allowed = ['patient_id', 'encounter_id', 'test_type', 'test_name', 'status', 'result_value', 'result_unit', 'reference_range', 'abnormal_flag', 'result_date', 'ordering_provider_id', 'notes'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE lab_orders SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Lab Order Update Trace: ${err.message}`);
          logAudit(getUserId(req), 'update_lab_order', `Failed to update lab order ${id}`, 'lab_order', 'failed', id);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Lab order not found.' });
        logAudit(getUserId(req), 'update_lab_order', `Updated lab order ${id}`, 'lab_order', 'success', id);
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'lab:order')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run(`DELETE FROM lab_orders WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Lab Order Delete Trace: ${err.message}`);
      logAudit(getUserId(req), 'delete_lab_order', `Failed to delete lab order ${id}`, 'lab_order', 'failed', id);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Lab order not found.' });
    logAudit(getUserId(req), 'delete_lab_order', `Deleted lab order ${id}`, 'lab_order', 'success', id);
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
