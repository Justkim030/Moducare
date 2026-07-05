const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { validateEmail, validateRequired, sanitizeString } = require('../middleware/validation');
const { signToken, verifyToken } = require('../utils/jwt');
const { resetRateLimit } = require('../middleware/rateLimit');

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

async function verifyPassword(password, hash) {
  if (!hash || hash.length < 10) return false;
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(password, hash);
  }
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash === legacyHash) {
    return { ok: true, legacy: true };
  }
  return false;
}

async function handleLogin(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', async () => {
    try {
      const { email, password } = JSON.parse(body || '{}');

      if (!email || !password) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Credentials missing' });
      }

      if (!validateEmail(email)) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Invalid email format.' });
      }

      const query = `
        SELECT u.id, u.email, u.phone_number, u.passwordHash, e.id AS employee_id, e.name, e.role_id, r.name AS role_name, r.department_id, d.name AS department_name
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
        INNER JOIN roles r ON r.id = e.role_id
        LEFT JOIN departments d ON d.id = r.department_id
        WHERE LOWER(u.email) = LOWER(?)
      `;

      db.get(query, [email], async (getErr, account) => {
        if (getErr || !account) {
          if (getErr) console.error(`[SECURE EXCEPTION] Login Database Error: ${getErr.message}`);
          return sendSecureJSON(res, 401, { ok: false, error: 'Invalid credentials' });
        }

        const valid = await verifyPassword(password, account.passwordHash);
        if (!valid) {
          return sendSecureJSON(res, 401, { ok: false, error: 'Invalid credentials' });
        }

        if (valid.legacy) {
          const newHash = await hashPassword(password);
          db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, account.id], () => {});
        }

        const safeUserSession = {
          id: account.id,
          employee_id: account.employee_id,
          name: account.name,
          email: account.email,
          phone_number: account.phone_number,
          role_id: account.role_id,
          role_name: account.role_name,
          department_id: account.department_id,
          department_name: account.department_name
        };

        const token = signToken(safeUserSession);

        resetRateLimit(req);

        return sendSecureJSON(res, 200, { ok: true, user: safeUserSession, token });
      });

    } catch (e) {
      console.error(`[SECURE EXCEPTION] Login Payload Error: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed system payload.' });
    }
  });
}

async function handleRegister(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', async () => {
    try {
      const p = JSON.parse(body || '{}');
      const { name, email, password, phone_number, role_id, department_id } = p;

      const missing = validateRequired([name, email, password]);
      if (missing.length > 0) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Missing fields: ' + missing.join(', ') });
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
      const assignedRoleId = role_id || 'role_nurse';

      db.serialize(() => {
        db.run(
          'INSERT INTO users (id, email, phone_number, passwordHash) VALUES (?, ?, ?, ?)',
          [userId, email, phone_number || null, passwordHash],
          function (err) {
            if (err) {
              console.error(`[SECURE EXCEPTION] User Write Trace: ${err.message}`);
              return sendSecureJSON(res, 400, { ok: false, error: 'Account generation could not be processed.' });
            }

            const safeSession = {
              id: userId,
              employee_id: employeeId,
              name,
              email,
              phone_number: phone_number || null,
              role_id: assignedRoleId,
            };

            const token = signToken(safeSession);

            db.run(
              'INSERT INTO employees (id, name, user_id, role_id, department_id) VALUES (?, ?, ?, ?, ?)',
              [employeeId, sanitizeString(name) || '', userId, assignedRoleId, department_id || null],
              function (empErr) {
                if (empErr) {
                  console.error(`[SECURE EXCEPTION] Employee Profile Trace: ${empErr.message}`);
                  return sendSecureJSON(res, 500, { ok: false, error: 'Internal profile mapping anomaly.' });
                }

                return sendSecureJSON(res, 201, {
                  ok: true,
                  user: { id: userId, employee_id: employeeId, name, email, role_id: assignedRoleId, department_id },
                  token,
                });
              }
            );
          }
        );
      });
    } catch (e) {
      console.error(`[SECURE EXCEPTION] Malformed Payload Received: ${e.message}`);
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed system payload.' });
    }
  });
}

module.exports = { handleRegister, handleLogin, sendSecureJSON, hashPassword, verifyPassword };