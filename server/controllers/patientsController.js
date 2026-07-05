const db = require('../config/db');
const { validateRequired, validateEmail, validatePhone, sanitizeString, validateUUID } = require('../middleware/validation');

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
  const search = (params.get('q') || '').toLowerCase();

  let sql = `SELECT p.id, p.name, p.email, p.phone_number, p.dob, p.gender, p.address, p.county, p.hiv_status, COUNT(a.id) as appointment_count FROM patients p LEFT JOIN appointments a ON a.patient_id = p.id`;
  const args = [];
  if (search) {
    sql += ` WHERE LOWER(p.name) LIKE ? OR LOWER(p.email) LIKE ? OR LOWER(p.phone_number) LIKE ?`;
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ` GROUP BY p.id ORDER BY p.name COLLATE NOCASE ASC`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Patients List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const patients = (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone_number: r.phone_number,
      dob: r.dob,
      gender: r.gender,
      address: r.address,
      county: r.county,
      hiv_status: r.hiv_status,
      appointment_count: r.appointment_count || 0,
    }));
    return sendSecureJSON(res, 200, { ok: true, patients });
  });
}

function handleGet(req, res) {
  const id = req.url.split('/').pop();
  db.get(`SELECT p.id, p.name, p.email, p.phone_number, p.dob, p.gender, p.address, p.county, p.next_of_kin, p.next_of_kin_phone, p.ampkh_id, p.national_id, p.insurance_id, p.hiv_status, a.time, a.type, a.status, e.name as doctor FROM patients p LEFT JOIN appointments a ON a.patient_id = p.id LEFT JOIN employees e ON e.id = a.employee_id WHERE p.id = ? ORDER BY a.time DESC LIMIT 20`, [id], (err, row) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Patient Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!row) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Patient not found' });
    }
    const userId = req.user?.id || null;
    db.run(`INSERT INTO audit (user_id, action, details, resource_type, resource_id, status) VALUES (?, 'view_patient', ?, 'patient', ?, 'success')`, [userId, `Viewed patient record ${id}`, id], () => {});
    return sendSecureJSON(res, 200, { ok: true, patient: row });
  });
}

function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { id, name, email, phone_number, dob, gender, address, county, next_of_kin, next_of_kin_phone, ampkh_id, national_id, insurance_id, hiv_status } = p;

      const missing = validateRequired([name]);
      if (missing.length > 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Missing required fields: ' + missing.join(', ') });
      }

      if (email && !validateEmail(email)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid email format.' });
      }

      if (phone_number && !validatePhone(phone_number)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid phone number format. Use +2547XXXXXXXX or 07XXXXXXXX.' });
      }

      const sanitized = {
        name: sanitizeString(name),
        email: email ? sanitizeString(email) : null,
        phone_number: phone_number ? sanitizeString(phone_number) : null,
        dob: dob ? sanitizeString(dob) : null,
        gender: gender ? sanitizeString(gender) : null,
        address: address ? sanitizeString(address) : null,
        county: county ? sanitizeString(county) : null,
        next_of_kin: next_of_kin ? sanitizeString(next_of_kin) : null,
        next_of_kin_phone: next_of_kin_phone ? sanitizeString(next_of_kin_phone) : null,
        ampkh_id: ampkh_id ? sanitizeString(ampkh_id) : null,
        national_id: national_id ? sanitizeString(national_id) : null,
        insurance_id: insurance_id ? sanitizeString(insurance_id) : null,
        hiv_status: hiv_status ? sanitizeString(hiv_status) : 'unknown',
      };

      const patientId = id || ('pat_' + Date.now());

      if (id && !validateUUID(id)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid patient ID format.' });
      }

      db.run(`INSERT INTO patients (id, name, email, phone_number, dob, gender, address, county, next_of_kin, next_of_kin_phone, ampkh_id, national_id, insurance_id, hiv_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, sanitized.name, sanitized.email, sanitized.phone_number, sanitized.dob, sanitized.gender, sanitized.address, sanitized.county, sanitized.next_of_kin, sanitized.next_of_kin_phone, sanitized.ampkh_id, sanitized.national_id, sanitized.insurance_id, sanitized.hiv_status],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Patient Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Patient ID already exists or invalid.' });
          }
          return sendSecureJSON(res, 201, {
            ok: true,
            patient: { id: patientId, ...sanitized },
          });
        }
      );
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
      const { name, email, phone_number, dob, gender, address, county, next_of_kin, next_of_kin_phone, ampkh_id, national_id, insurance_id, hiv_status } = p;

      const fields = [];
      const values = [];
      if (name !== undefined) {
        fields.push('name = ?');
        values.push(sanitizeString(name));
      }
      if (email !== undefined) {
        if (!validateEmail(email)) {
          return sendSecureJSON(res, 400, { ok: false, error: 'Invalid email format.' });
        }
        fields.push('email = ?');
        values.push(sanitizeString(email));
      }
      if (phone_number !== undefined) {
        if (!validatePhone(phone_number)) {
          return sendSecureJSON(res, 400, { ok: false, error: 'Invalid phone number format.' });
        }
        fields.push('phone_number = ?');
        values.push(sanitizeString(phone_number));
      }
      const optionalText = ['dob', 'gender', 'address', 'county', 'next_of_kin', 'next_of_kin_phone', 'ampkh_id', 'national_id', 'insurance_id'];
      optionalText.forEach(k => {
        if (p[k] !== undefined) {
          fields.push(`${k} = ?`);
          values.push(sanitizeString(p[k]));
        }
      });
      if (hiv_status !== undefined) {
        fields.push('hiv_status = ?');
        values.push(sanitizeString(hiv_status));
      }
      values.push(id);

      db.run(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Patient Update Trace: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
        }
        if (this.changes === 0) {
          return sendSecureJSON(res, 404, { ok: false, error: 'Patient not found.' });
        }
        return sendSecureJSON(res, 200, { ok: true });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function handleDelete(req, res) {
  const id = req.url.split('/').pop();
  db.run(`DELETE FROM patients WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error(`[SECURE EXCEPTION] Patient Delete Trace: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
    }
    if (this.changes === 0) {
      return sendSecureJSON(res, 404, { ok: false, error: 'Patient not found.' });
    }
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