const db = require('../config/db');
const { hasCapability, CAPABILITIES } = require('../config/permissions');

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

function getId(req) {
  const parts = req.url.split('/');
  return parts[parts.length - 1];
}

function isRoleManager(req) {
  return req.user && (req.user.role_id === 'role_admin' || hasCapability(req.user.role_id, 'role:manage'));
}

function handleList(req, res) {
  if (!isRoleManager(req)) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: role:manage' });
  }
  db.all(`SELECT id, name, department_id FROM roles ORDER BY name ASC`, [], (err, roles) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] RolePermissions List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    db.all(`SELECT role_id, capability FROM role_permissions`, [], (err2, perms) => {
      if (err2) {
        console.error(`[SECURE EXCEPTION] RolePermissions Load Error: ${err2.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const map = {};
      for (const row of perms || []) {
        if (!map[row.role_id]) map[row.role_id] = [];
        map[row.role_id].push(row.capability);
      }
      const result = (roles || []).map(r => ({
        id: r.id,
        name: r.name,
        department_id: r.department_id,
        capabilities: map[r.id] || []
      }));
      return sendSecureJSON(res, 200, { ok: true, roles: result });
    });
  });
}

function handleGet(req, res) {
  if (!isRoleManager(req)) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: role:manage' });
  }
  const roleId = getId(req);
  db.get(`SELECT id, name, department_id FROM roles WHERE id = ?`, [roleId], (err, role) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] RolePermissions Detail Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    if (!role) return sendSecureJSON(res, 404, { ok: false, error: 'Role not found.' });
    db.all(`SELECT capability FROM role_permissions WHERE role_id = ?`, [roleId], (err2, perms) => {
      if (err2) {
        console.error(`[SECURE EXCEPTION] RolePermissions Caps Error: ${err2.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      const capabilities = (perms || []).map(p => p.capability);
      return sendSecureJSON(res, 200, { ok: true, role: { id: role.id, name: role.name, department_id: role.department_id, capabilities } });
    });
  });
}

function handleUpdate(req, res) {
  if (!isRoleManager(req)) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: role:manage' });
  }
  const roleId = getId(req);
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const caps = Array.isArray(p.capabilities) ? p.capabilities : [];
      const performer = req.user.id || null;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION', () => {
          db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId], (delErr) => {
            if (delErr) {
              db.run('ROLLBACK', () => {});
              console.error(`[SECURE EXCEPTION] RolePerm Delete Trace: ${delErr.message}`);
              return sendSecureJSON(res, 500, { ok: false, error: 'Update failed.' });
            }
            if (caps.length === 0) {
              return db.run('COMMIT', () => finalizeAudit(roleId, [], performer, res));
            }
            let pending = caps.length;
            let failed = false;
            caps.forEach((cap) => {
              db.run(`INSERT INTO role_permissions (role_id, capability) VALUES (?, ?)`, [roleId, cap], function (iErr) {
                if (iErr && !failed) {
                  failed = true;
                  db.run('ROLLBACK', () => {});
                  console.error(`[SECURE EXCEPTION] RolePerm Insert Trace: ${iErr.message}`);
                  return sendSecureJSON(res, 400, { ok: false, error: 'Failed to update capabilities.' });
                }
                pending -= 1;
                if (pending === 0 && !failed) {
                  db.run('COMMIT', () => finalizeAudit(roleId, caps, performer, res));
                }
              });
            });
          });
        });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

function finalizeAudit(roleId, caps, performer, res) {
  if (caps.length === 0) {
    return sendSecureJSON(res, 200, { ok: true, role_id: roleId, capabilities: [] });
  }
  let pending = caps.length;
  let responded = false;
  caps.forEach((cap, idx) => {
    const id = 'rau_' + Date.now() + '_' + idx;
    db.run(`INSERT INTO role_permission_audit (id, role_id, capability, action, performed_by) VALUES (?, ?, ?, 'granted', ?)`,
      [id, roleId, cap, performer],
      function (aErr) {
        if (aErr) {
          console.error(`[SECURE EXCEPTION] RoleAudit Trace: ${aErr.message}`);
        }
        pending -= 1;
        if (pending === 0 && !responded) {
          responded = true;
          return sendSecureJSON(res, 200, { ok: true, role_id: roleId, capabilities: caps });
        }
      });
  });
}

function handleCapabilities(req, res) {
  if (!req.user) {
    return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
  }
  return sendSecureJSON(res, 200, { ok: true, capabilities: CAPABILITIES });
}

function handleAudit(req, res) {
  if (!isRoleManager(req)) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: role:manage' });
  }
  db.all(`SELECT * FROM role_permission_audit ORDER BY performed_at DESC`, [], (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] RoleAudit List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, audit: rows || [] });
  });
}

module.exports = { handleList, handleGet, handleUpdate, handleCapabilities, handleAudit };
