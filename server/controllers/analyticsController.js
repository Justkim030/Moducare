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

function handleOverview(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  Promise.all([
    queryGet("SELECT COUNT(*) as totalPatients FROM patients", { totalPatients: 0 }),
    queryGet("SELECT COUNT(*) as activePatients FROM patients WHERE hiv_status = 'positive'", { activePatients: 0 }),
    queryGet("SELECT COUNT(*) as totalEncounters FROM encounters", { totalEncounters: 0 }),
    queryGet("SELECT COUNT(*) as totalLabOrders FROM lab_orders", { totalLabOrders: 0 }),
    queryGet("SELECT COUNT(*) as pendingLabOrders FROM lab_orders WHERE status = 'ordered' OR status = 'processing'", { pendingLabOrders: 0 }),
    queryGet("SELECT COUNT(*) as totalDispensing FROM pharmacy_dispensing", { totalDispensing: 0 }),
    queryGet("SELECT COUNT(*) as totalAppointments FROM appointments", { totalAppointments: 0 }),
    queryGet("SELECT COUNT(*) as scheduledAppointments FROM appointments WHERE status = 'scheduled'", { scheduledAppointments: 0 }),
    queryGet("SELECT COUNT(*) as totalNotifications FROM notifications", { totalNotifications: 0 }),
    queryGet("SELECT COUNT(*) as unreadNotifications FROM notifications WHERE read_at IS NULL", { unreadNotifications: 0 }),
    queryGet("SELECT COUNT(*) as totalInventory FROM inventory", { totalInventory: 0 }),
    queryGet("SELECT COUNT(*) as lowStockItems FROM inventory WHERE current_stock <= reorder_level", { lowStockItems: 0 }),
    queryGet("SELECT COUNT(*) as totalReferrals FROM referrals", { totalReferrals: 0 }),
    queryGet("SELECT COUNT(*) as pendingReferrals FROM referrals WHERE status = 'pending'", { pendingReferrals: 0 }),
  ]).then(([
    totalPatients, activePatients, totalEncounters, totalLabOrders,
    pendingLabOrders, totalDispensing, totalAppointments, scheduledAppointments,
    totalNotifications, unreadNotifications, totalInventory, lowStockItems,
    totalReferrals, pendingReferrals
  ]) => {
    const stats = {
      totalPatients: totalPatients.totalPatients || 0,
      activePatients: activePatients.activePatients || 0,
      totalEncounters: totalEncounters.totalEncounters || 0,
      totalLabOrders: totalLabOrders.totalLabOrders || 0,
      pendingLabOrders: pendingLabOrders.pendingLabOrders || 0,
      totalDispensing: totalDispensing.totalDispensing || 0,
      totalAppointments: totalAppointments.totalAppointments || 0,
      scheduledAppointments: scheduledAppointments.scheduledAppointments || 0,
      totalNotifications: totalNotifications.totalNotifications || 0,
      unreadNotifications: unreadNotifications.unreadNotifications || 0,
      totalInventory: totalInventory.totalInventory || 0,
      lowStockItems: lowStockItems.lowStockItems || 0,
      totalReferrals: totalReferrals.totalReferrals || 0,
      pendingReferrals: pendingReferrals.pendingReferrals || 0,
    };
    return sendSecureJSON(res, 200, { ok: true, stats });
  }).catch(() => {
    return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
  });
}

function handleList(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'analytics:read')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const period = params.get('period') || 'month';
  const metric = params.get('metric') || 'encounters';

  const page = parseInt(params.get('page')) || 1;
  const limit = Math.min(Math.max(parseInt(params.get('limit')) || 25, 1), 100);
  const offset = (page - 1) * limit;

  let sql = `SELECT a.id, a.metric, a.value, a.period, a.recorded_at FROM analytics a WHERE 1=1`;
  const args = [];
  if (period) { sql += ` AND a.period = ?`; args.push(period); }
  if (metric) { sql += ` AND a.metric = ?`; args.push(metric); }

  let countSql = `SELECT COUNT(*) as total FROM analytics a WHERE 1=1`;
  const countArgs = [];
  if (period) { countSql += ` AND a.period = ?`; countArgs.push(period); }
  if (metric) { countSql += ` AND a.metric = ?`; countArgs.push(metric); }

  sql += ` ORDER BY a.recorded_at DESC LIMIT ? OFFSET ?`;

  db.get(countSql, countArgs, (err, countRow) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Analytics List Count Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    db.all(sql, [...args, limit, offset], (err2, rows) => {
      if (err2) {
        console.error(`[SECURE EXCEPTION] Analytics List Error: ${err2.message}`);
        return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
      }
      return sendSecureJSON(res, 200, { ok: true, data: rows || [], pagination: { page: page, limit: limit, total: total, totalPages: totalPages } });
    });
  });
}

function handleCreate(req, res) {
  if (!req.user || !req.user.role_id || !hasCapability(req.user.role_id, 'report:export')) {
    return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
  }

  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { metric, value, period } = p;
      if (!metric || value === undefined) {
        return sendSecureJSON(res, 400, { ok: false, error: 'Metric and value are required.' });
      }
      db.run(`INSERT INTO analytics (metric, value, period, recorded_at) VALUES (?, ?, ?, datetime('now'))`,
        [metric, value, period || 'custom'],
        function (err) {
          if (err) {
            console.error(`[SECURE EXCEPTION] Analytics Create Trace: ${err.message}`);
            return sendSecureJSON(res, 400, { ok: false, error: 'Analytics record creation failed.' });
          }
          return sendSecureJSON(res, 201, { ok: true, analytics: { id: this.lastID, metric, value, period } });
        });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

module.exports = { handleOverview, handleList, handleCreate };
