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

function queryGet(sql, defaults = {}) {
  return new Promise((resolve) => {
    db.get(sql, (err, row) => {
      resolve({ ...defaults, ...(row || {}) });
    });
  });
}

function handleDashboard(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'dashboard:view')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  Promise.all([
    queryGet("SELECT COUNT(*) as value FROM operations WHERE status = 'active'", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM appointments WHERE status = 'scheduled'", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM patients", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM incidents WHERE status != 'Closed'", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM notifications WHERE read_at IS NULL", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM documents", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM operations WHERE status = 'pending'", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM operations", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM incidents", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM users", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM audit", { value: 0 }),
    queryGet("SELECT COALESCE(SUM(amount), 0) as value FROM finance WHERE status = 'pending'", { value: 0 }),
    queryGet("SELECT COUNT(*) as value FROM employees", { value: 0 }),
  ]).then(([tasks, appointments, patients, incidents, notifications, documents, teamTasks, totalOperations, totalIncidents, users, audit, finance, staffCount]) => {
    const stats = {
      tasks: tasks.value || 0,
      appointments: appointments.value || 0,
      patients: patients.value || 0,
      incidents: incidents.value || 0,
      notifications: notifications.value || 0,
      documents: documents.value || 0,
      teamTasks: teamTasks.value || 0,
      totalOperations: totalOperations.value || 0,
      totalIncidents: totalIncidents.value || 0,
      users: users.value || 0,
      audit: audit.value || 0,
      finance: finance.value || 0,
      staffCount: staffCount.value || 0,
    };
    return sendSecureJSON(res, 200, { ok: true, stats });
  }).catch(() => {
    return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
  });
}

module.exports = { handleDashboard };
