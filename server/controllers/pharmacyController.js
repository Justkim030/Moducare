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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'pharmacy:inventory_read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const patientId = params.get('patient_id') || '';
  const regimenType = params.get('regimen_type') || '';
  const { page, limit, offset } = parsePagination(params);

  const whereClauses = [];
  const args = [];
  if (patientId) { whereClauses.push(`pd.patient_id = ?`); args.push(patientId); }
  if (regimenType) { whereClauses.push(`pd.regimen_type = ?`); args.push(regimenType); }
  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(DISTINCT pd.id) as total FROM pharmacy_dispensing pd LEFT JOIN patients p ON p.id = pd.patient_id LEFT JOIN employees emp ON emp.id = pd.dispensed_by${whereSql}`;

  db.get(countSql, args, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Pharmacy Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit);

    const dataSql = `SELECT pd.id, pd.patient_id, pd.encounter_id, pd.drug_name, pd.drug_code, pd.dosage, pd.frequency, pd.duration_days, pd.quantity, pd.regimen_type, pd.adherence_counseled, pd.dispensed_by, pd.dispensed_date, pd.notes, p.name as patient_name, emp.name as dispensed_by_name FROM pharmacy_dispensing pd LEFT JOIN patients p ON p.id = pd.patient_id LEFT JOIN employees emp ON emp.id = pd.dispensed_by${whereSql} ORDER BY pd.dispensed_date DESC LIMIT ? OFFSET ?`;

    db.all(dataSql, args.concat([limit, offset]), (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Pharmacy List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, { ok: true, dispensing: rows || [], pagination: { page, limit, total, totalPages } });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'pharmacy:inventory_read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get(`SELECT pd.id, pd.patient_id, pd.encounter_id, pd.drug_name, pd.drug_code, pd.dosage, pd.frequency, pd.duration_days, pd.quantity, pd.regimen_type, pd.adherence_counseled, pd.dispensed_by, pd.dispensed_date, pd.notes, p.name as patient_name, emp.name as dispensed_by_name FROM pharmacy_dispensing pd LEFT JOIN patients p ON p.id = pd.patient_id LEFT JOIN employees emp ON emp.id = pd.dispensed_by WHERE pd.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Pharmacy Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Dispensing record not found' });
    const userId = getUserId(req);
    db.run(`INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, 'dispense', ?, 'pharmacy', ?, 'success')`, [userId, `Viewed pharmacy record ${id} for patient ${row.patient_id}`, id], () => {});
    return sendSecureJSON(res, 200, { ok: true, dispensing: row });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'pharmacy:dispense')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, encounter_id, drug_name, drug_code, dosage, frequency, duration_days, quantity, regimen_type, adherence_counseled, dispensed_by, notes } = p;
      if (!patient_id || !drug_name) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient and drug name are required.' });
      }
      db.run(`INSERT INTO pharmacy_dispensing (patient_id, encounter_id, drug_name, drug_code, dosage, frequency, duration_days, quantity, regimen_type, adherence_counseled, dispensed_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient_id, encounter_id || null, drug_name, drug_code || '', dosage || '', frequency || '', duration_days || null, quantity || null, regimen_type || '', adherence_counseled ? 1 : 0, dispensed_by || null, notes || ''],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Pharmacy Create Trace: ${err.message}`);
            logAudit(getUserId(req), 'create_pharmacy_dispense', `Failed to dispense ${drug_name} for patient ${patient_id}`, 'pharmacy', 'failed', null);
            return sendSecureJSON(res, 400, { ok: false, error: 'Dispensing record creation failed.' });
          }
          const newId = this.lastID;
          logAudit(getUserId(req), 'create_pharmacy_dispense', `Dispensed ${drug_name} for patient ${patient_id}`, 'pharmacy', 'success', newId);
          return sendSecureJSON(res, 201, { ok: true, dispensing: { id: newId, patient_id, drug_name, regimen_type } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'pharmacy:dispense')) {
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
      const allowed = ['patient_id', 'encounter_id', 'drug_name', 'drug_code', 'dosage', 'frequency', 'duration_days', 'quantity', 'regimen_type', 'adherence_counseled', 'dispensed_by', 'notes'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE pharmacy_dispensing SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Pharmacy Update Trace: ${err.message}`);
          logAudit(getUserId(req), 'update_pharmacy_dispense', `Failed to update pharmacy record ${id}`, 'pharmacy', 'failed', id);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Dispensing record not found.' });
        logAudit(getUserId(req), 'update_pharmacy_dispense', `Updated pharmacy record ${id}`, 'pharmacy', 'success', id);
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'pharmacy:dispense')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run(`DELETE FROM pharmacy_dispensing WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Pharmacy Delete Trace: ${err.message}`);
      logAudit(getUserId(req), 'delete_pharmacy_dispense', `Failed to delete pharmacy record ${id}`, 'pharmacy', 'failed', id);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Dispensing record not found.' });
    logAudit(getUserId(req), 'delete_pharmacy_dispense', `Deleted pharmacy record ${id}`, 'pharmacy', 'success', id);
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
