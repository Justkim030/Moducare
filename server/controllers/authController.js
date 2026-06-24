const bcrypt = require('bcryptjs');
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

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  if (!hash || hash.length < 60) return false;
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(password, hash);
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

      const query = `
        SELECT u.id, u.email, u.phone_number, u.passwordHash, e.id AS employee_id, e.name, e.role_id
        FROM users u
        INNER JOIN employees e ON e.user_id = u.id
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

        const safeUserSession = {
          id: account.id,
          employee_id: account.employee_id,
          name: account.name,
          email: account.email,
          phone_number: account.phone_number,
          role_id: account.role_id
        };

        return sendSecureJSON(res, 200, { ok: true, user: safeUserSession });
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
      const { name, email, password, phone_number, role_id } = p;

      if (!email || !password || !name) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Registration requirements incomplete.' });
      }

      const passwordHash = await hashPassword(password);
      const userId = 'usr_' + Date.now();
      const employeeId = 'emp_' + Date.now();
      const assignedRoleId = role_id || 'role_nurse';

      db.serialize(() => {
        let executionError = false;

        db.run(
          'INSERT INTO users (id, email, phone_number, passwordHash) VALUES (?, ?, ?, ?)',
          [userId, email, phone_number || null, passwordHash],
          function (err) {
            if (err) {
              executionError = true;
              console.error(`[SECURE EXCEPTION] User Write Trace: ${err.message}`);
              return sendSecureJSON(res, 400, { ok: false, error: 'Account generation could not be processed.' });
            }

            db.run(
              'INSERT INTO employees (id, name, user_id, role_id) VALUES (?, ?, ?, ?)',
              [employeeId, name, userId, assignedRoleId],
              function (empErr) {
                if (empErr) {
                  console.error(`[SECURE EXCEPTION] Employee Profile Trace: ${empErr.message}`);
                  return sendSecureJSON(res, 500, { ok: false, error: 'Internal profile mapping anomaly.' });
                }

                return sendSecureJSON(res, 201, {
                  ok: true,
                  user: { id: userId, employee_id: employeeId, name, email },
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