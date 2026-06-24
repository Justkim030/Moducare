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
  const regimenType = params.get('regimen_type') || '';

  let sql = `SELECT pd.id, pd.patient_id, pd.encounter_id, pd.drug_name, pd.drug_code, pd.dosage, pd.frequency, pd.duration_days, pd.quantity, pd.regimen_type, pd.adherence_counseled, pd.dispensed_by, pd.dispensed_date, pd.notes, p.name as patient_name, emp.name as dispensed_by_name FROM pharmacy_dispensing pd LEFT JOIN patients p ON p.id = pd.patient_id LEFT JOIN employees emp ON emp.id = pd.dispensed_by WHERE 1=1`;
  const args = [];

  if (patientId) { sql += ` AND pd.patient_id = ?`; args.push(patientId); }
  if (regimenType) { sql += ` AND pd.regimen_type = ?`; args.push(regimenType); }

  sql += ` ORDER BY pd.dispensed_date DESC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Pharmacy List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, dispensing: rows || [] });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT pd.id, pd.patient_id, pd.encounter_id, pd.drug_name, pd.drug_code, pd.dosage, pd.frequency, pd.duration_days, pd.quantity, pd.regimen_type, pd.adherence_counseled, pd.dispensed_by, pd.dispensed_date, pd.notes, p.name as patient_name, emp.name as dispensed_by_name FROM pharmacy_dispensing pd LEFT JOIN patients p ON p.id = pd.patient_id LEFT JOIN employees emp ON emp.id = pd.dispensed_by WHERE pd.id = ?`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Pharmacy Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'Dispensing record not found' });
    return sendSecureJSON(res, 200, { ok: true, dispensing: row });
  });
}

function handleCreate(req, res) {
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
            return sendSecureJSON(res, 400, { ok: false, error: 'Dispensing record creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, dispensing: { id: this.lastID, patient_id, drug_name, regimen_type } });
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
      const allowed = ['patient_id', 'encounter_id', 'drug_name', 'drug_code', 'dosage', 'frequency', 'duration_days', 'quantity', 'regimen_type', 'adherence_counseled', 'dispensed_by', 'notes'];
      allowed.forEach(k => { if (p[k] !== undefined) { fields.push(`${k} = ?`); values.push(p[k]); } });
      if (fields.length === 0) return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      values.push(id);
      db.run(`UPDATE pharmacy_dispensing SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Pharmacy Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Dispensing record not found.' });
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM pharmacy_dispensing WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Pharmacy Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) return sendSecureJSON(res, 404, { ok: false, error: 'Dispensing record not found.' });
    return sendSecureJSON(res, 200, { ok: true });
  });
}

module.exports = { handleList, handleGet, handleCreate, handleUpdate, handleDelete };
