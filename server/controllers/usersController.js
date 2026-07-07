const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { validateEmail, sanitizeString } = require('../middleware/validation');

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

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function handleList(req, res) {
   const ADMIN_ROLES = ['role_dev', 'admin', 'role_admin'];
   if (!req.user || !req.user.role_id || !ADMIN_ROLES.includes(req.user.role_id)) {
     return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
   }

    db.all(`SELECT u.id, u.email, u.phone_number, e.name, r.name as role_name, r.id as role_id, r.department_id FROM users u LEFT JOIN employees e ON e.user_id = u.id LEFT JOIN roles r ON r.id = e.role_id`, (err, rows) => {
     if (err) {
       console.error(`[SECURE EXCEPTION] Users List Database Error: ${err.message}`);
       return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
     }
const users = (rows || []).map(r => ({
        id: r.id,
        email: r.email,
        phone_number: r.phone_number,
        name: r.name || '',
        role: r.role_id || '',
        role_label: r.role_name || '',
        department_id: r.department_id || '',
      }));
     return sendSecureJSON(res, 200, { ok: true, users });
   });
 }

 function handleGet(req, res) {
   const ADMIN_ROLES = ['role_dev', 'admin', 'role_admin'];
   if (!req.user || !req.user.role_id || !ADMIN_ROLES.includes(req.user.role_id)) {
     return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
   }

   const id = req.url.split('/').pop();
   db.get(`SELECT u.id, u.email, u.phone_number, e.name, r.name as role_name, r.id as role_id FROM users u LEFT JOIN employees e ON e.user_id = u.id LEFT JOIN roles r ON r.id = e.role_id WHERE u.id = ?`, [id], (err, row) => {
     if (err) {
       console.error(`[SECURE EXCEPTION] User Detail Error: ${err.message}`);
       return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
     }
     if (!row) return sendSecureJSON(res, 404, { ok: false, error: 'User not found' });
     return sendSecureJSON(res, 200, { ok: true, user: row });
   });
 }

async function handleCreate(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', async () => {
    try {
      const p = JSON.parse(body || '{}');
      const { name, email, password, phone_number, role_id } = p;

      if (!email || !password) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Email and password are required.' });
      }

      if (!validateEmail(email)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid email format.' });
      }

      if (password.length < 8) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Password must be at least 8 characters.' });
      }

      const passwordHash = await hashPassword(password);
      const userId = 'usr_' + Date.now();
      const employeeId = 'emp_' + Date.now();
      const assignedRole = role_id || 'role_nurse';

      db.serialize(() => {
        db.run('INSERT INTO users (id, email, phone_number, passwordHash) VALUES (?, ?, ?, ?)',
          [userId, email, phone_number || null, passwordHash],
          function (err) {
            if (err) {
              console.error(`[SECURE EXCEPTION] User Create Trace: ${err.message}`);
              return sendSecureJSON(res, 400, { ok: false, error: 'Email already exists or invalid.' });
            }

            db.run('INSERT INTO employees (id, name, user_id, role_id) VALUES (?, ?, ?, ?)',
              [employeeId, sanitizeString(name) || '', userId, assignedRole],
              function (empErr) {
                if (empErr) {
                  console.error(`[SECURE EXCEPTION] Employee Create Trace: ${empErr.message}`);
                  return sendSecureJSON(res, 500, { ok: false, error: 'Profile creation failed.' });
                }

                return sendSecureJSON(res, 201, {
                  ok: true,
                  user: { id: userId, email, name: sanitizeString(name) || '', role: assignedRole },
                });
              }
            );
          }
        );
      });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Malformed Payload: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed system payload.' });
    }
  });
}

async function handleUpdate(req, res) {
  const id = req.url.split('/').pop();
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', async () => {
    try {
      const p = JSON.parse(body || '{}');
      const { name, email, password, role_id, phone_number } = p;

      const userFields = [];
      const userValues = [];
      const empFields = [];
      const empValues = [];

      if (email !== undefined) {
        if (!validateEmail(email)) {
          return sendSecureJSON(res, 400, { ok: false, error: 'Invalid email format.' });
        }
        userFields.push('email = ?');
        userValues.push(email);
      }
      if (phone_number !== undefined) {
        userFields.push('phone_number = ?');
        userValues.push(sanitizeString(phone_number));
      }
      if (password !== undefined) {
        if (password.length < 8) {
          return sendSecureJSON(res, 400, { ok: false, error: 'Password must be at least 8 characters.' });
        }
        const hash = await hashPassword(password);
        userFields.push('passwordHash = ?');
        userValues.push(hash);
      }
      if (role_id !== undefined) {
        empFields.push('role_id = ?');
        empValues.push(role_id);
      }
      if (name !== undefined) {
        empFields.push('name = ?');
        empValues.push(sanitizeString(name));
      }

      if (userFields.length === 0 && empFields.length === 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'No fields to update.' });
      }

      db.serialize(() => {
        if (userFields.length > 0) {
          userValues.push(id);
          db.run(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userValues, (err) => {
            if (err) {
              console.error(`[SECURE EXCEPTION] User Update Trace: ${err.message}`);
              return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
            }
          });
        }
        if (empFields.length > 0) {
          empValues.push(id);
          db.run(`UPDATE employees SET ${empFields.join(', ')} WHERE user_id = ?`, empValues, (err) => {
            if (err) {
              console.error(`[SECURE EXCEPTION] Employee Update Trace: ${err.message}`);
              return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
            }
          });
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
  db.serialize(() => {
    db.run('DELETE FROM employees WHERE user_id = ?', [id], function (e1) {
      if (e1) {
        console.error(`[SECURE EXCEPTION] Employee Delete Trace: ${e1.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
      }
      db.run('DELETE FROM users WHERE id = ?', [id], function (e2) {
        if (e2) {
          console.error(`[SECURE EXCEPTION] User Delete Trace: ${e2.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Delete failed.' });
        }
        return sendSecureJSON(res, 200, { ok: true });
      });
    });
  });
}

module.exports = {
   handleList,
   handleGet,
   handleCreate,
   handleUpdate,
   handleDelete
 };