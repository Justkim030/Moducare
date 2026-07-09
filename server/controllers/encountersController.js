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
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'encounter:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const patientId = params.get('patient_id') || '';
  const { page, limit, offset } = parsePagination(params);

  const whereClauses = [];
  const args = [];
  if (patientId) {
    whereClauses.push(`e.patient_id = ?`);
    args.push(patientId);
  }
  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(DISTINCT e.id) as total FROM encounters e LEFT JOIN patients p ON p.id = e.patient_id LEFT JOIN employees emp ON emp.id = e.provider_id${whereSql}`;

  db.get(countSql, args, (countErr, countRow) => {
    if (countErr) {
      console.error(`[SECURE EXCEPTION] Encounters Count Error: ${countErr.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit);

    const dataSql = `SELECT e.id, e.patient_id, e.encounter_date, e.visit_type, e.provider_id, e.chief_complaint, e.vitals, e.diagnoses, e.soap_notes, e.hiv_viral_load, e.hiv_cd4, e.art_regimen, e.art_adherence, e.follow_up_plan, p.name as patient_name, emp.name as provider_name FROM encounters e LEFT JOIN patients p ON p.id = e.patient_id LEFT JOIN employees emp ON emp.id = e.provider_id${whereSql} ORDER BY e.encounter_date DESC LIMIT ? OFFSET ?`;

    db.all(dataSql, args.concat([limit, offset]), (err, rows) => {
      if (err) {
        console.error(`[SECURE EXCEPTION] Encounters List Error: ${err.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const encounters = (rows || []).map(r => ({
        ...r,
        vitals: (() => { try { return r.vitals ? JSON.parse(r.vitals) : {}; } catch { return {}; } })(),
        diagnoses: (() => { try { return r.diagnoses ? JSON.parse(r.diagnoses) : []; } catch { return []; } })(),
      }));
      return sendSecureJSON(res, 200, { ok: true, encounters, pagination: { page, limit, total, totalPages } });
    });
  });
}

function handleGet(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'encounter:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.get(`SELECT e.id, e.patient_id, e.encounter_date, e.visit_type, e.provider_id, e.chief_complaint, e.vitals, e.diagnoses, e.soap_notes, e.hiv_viral_load, e.hiv_cd4, e.art_regimen, e.art_adherence, e.follow_up_plan, p.name as patient_name, emp.name as provider_name FROM encounters e LEFT JOIN patients p ON p.id = e.patient_id LEFT JOIN employees emp ON emp.id = e.provider_id WHERE e.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Encounter Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Encounter not found' });
    }
    const userId = getUserId(req);
    db.run(`INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, 'view_encounter', ?, 'encounter', ?, 'success')`, [userId, `Viewed encounter ${id} for patient ${row.patient_id}`, id], () => {});
    return sendSecureJSON(res, 200, {
      ok: true,
      encounter: {
        ...row,
        vitals: (() => { try { return row.vitals ? JSON.parse(row.vitals) : {}; } catch { return {}; } })(),
        diagnoses: (() => { try { return row.diagnoses ? JSON.parse(row.diagnoses) : []; } catch { return []; } })(),
      }
    });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'encounter:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, encounter_date, visit_type, provider_id, chief_complaint, vitals, diagnoses, soap_notes, hiv_viral_load, hiv_cd4, art_regimen, art_adherence, follow_up_plan } = p;

      if (!patient_id) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Patient is required.' });
      }

      db.run(
        `INSERT INTO encounters (patient_id, encounter_date, visit_type, provider_id, chief_complaint, vitals, diagnoses, soap_notes, hiv_viral_load, hiv_cd4, art_regimen, art_adherence, follow_up_plan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patient_id,
          encounter_date || new Date().toISOString(),
          visit_type || 'Outpatient',
          provider_id || null,
          chief_complaint || '',
          JSON.stringify(vitals || {}),
          JSON.stringify(diagnoses || []),
          soap_notes || '',
          hiv_viral_load || '',
          hiv_cd4 || '',
          art_regimen || '',
          art_adherence || '',
          follow_up_plan || ''
        ],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Encounter Create Trace: ${err.message}`);
            logAudit(getUserId(req), 'create_encounter', `Failed to create encounter for patient ${patient_id}`, 'encounter', 'failed', null);
            return sendSecureJSON(res, 400, { ok: false, error: 'Encounter creation failed.' });
          }
          const newId = this.lastID;
          logAudit(getUserId(req), 'create_encounter', `Created encounter ${newId} for patient ${patient_id}`, 'encounter', 'success', newId);
          return sendSecureJSON(res, 201, {
            ok: true,
            encounter: { id: newId, patient_id, encounter_date, visit_type, provider_id, chief_complaint, vitals, diagnoses, soap_notes, hiv_viral_load, hiv_cd4, art_regimen, art_adherence, follow_up_plan },
          });
        }
      );
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleUpdate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'encounter:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { patient_id, encounter_date, visit_type, provider_id, chief_complaint, vitals, diagnoses, soap_notes, hiv_viral_load, hiv_cd4, art_regimen, art_adherence, follow_up_plan } = p;

      const fields = [];
      const values = [];
      if (patient_id !== undefined) { fields.push('patient_id = ?'); values.push(patient_id); }
      if (encounter_date !== undefined) { fields.push('encounter_date = ?'); values.push(encounter_date); }
      if (visit_type !== undefined) { fields.push('visit_type = ?'); values.push(visit_type); }
      if (provider_id !== undefined) { fields.push('provider_id = ?'); values.push(provider_id); }
      if (chief_complaint !== undefined) { fields.push('chief_complaint = ?'); values.push(chief_complaint); }
      if (vitals !== undefined) { fields.push('vitals = ?'); values.push(JSON.stringify(vitals)); }
      if (diagnoses !== undefined) { fields.push('diagnoses = ?'); values.push(JSON.stringify(diagnoses)); }
      if (soap_notes !== undefined) { fields.push('soap_notes = ?'); values.push(soap_notes); }
      if (hiv_viral_load !== undefined) { fields.push('hiv_viral_load = ?'); values.push(hiv_viral_load); }
      if (hiv_cd4 !== undefined) { fields.push('hiv_cd4 = ?'); values.push(hiv_cd4); }
      if (art_regimen !== undefined) { fields.push('art_regimen = ?'); values.push(art_regimen); }
      if (art_adherence !== undefined) { fields.push('art_adherence = ?'); values.push(art_adherence); }
      if (follow_up_plan !== undefined) { fields.push('follow_up_plan = ?'); values.push(follow_up_plan); }
      values.push(id);

      db.run(`UPDATE encounters SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Encounter Update Trace: ${err.message}`);
          logAudit(getUserId(req), 'update_encounter', `Failed to update encounter ${id}`, 'encounter', 'failed', id);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Encounter not found.' });
        }
        logAudit(getUserId(req), 'update_encounter', `Updated encounter ${id}`, 'encounter', 'success', id);
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'encounter:write')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const id = req.url.split('/').pop();
  db.run(`DELETE FROM encounters WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Encounter Delete Trace: ${err.message}`);
      logAudit(getUserId(req), 'delete_encounter', `Failed to delete encounter ${id}`, 'encounter', 'failed', id);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Encounter not found.' });
    }
    logAudit(getUserId(req), 'delete_encounter', `Deleted encounter ${id}`, 'encounter', 'success', id);
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = {
  handleList,
  handleGet,
  handleCreate,
  handleUpdate,
  handleDelete
};
