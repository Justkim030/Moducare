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

function handleOverview(req, res) {
  const stats = {
    totalPatients: 0,
    activePatients: 0,
    totalEncounters: 0,
    totalLabOrders: 0,
    pendingLabOrders: 0,
    totalDispensing: 0,
    totalAppointments: 0,
    scheduledAppointments: 0,
    totalNotifications: 0,
    unreadNotifications: 0,
    totalInventory: 0,
    lowStockItems: 0,
    totalReferrals: 0,
    pendingReferrals: 0,
  };

  db.get(`SELECT COUNT(*) as totalPatients FROM patients`, (err, row) => {
    if (!err && row) stats.totalPatients = row.totalPatients;
    db.get(`SELECT COUNT(*) as activePatients FROM patients WHERE hiv_status = 'positive'`, (err, row) => {
      if (!err && row) stats.activePatients = row.activePatients;
      db.get(`SELECT COUNT(*) as totalEncounters FROM encounters`, (err, row) => {
        if (!err && row) stats.totalEncounters = row.totalEncounters;
        db.get(`SELECT COUNT(*) as totalLabOrders FROM lab_orders`, (err, row) => {
          if (!err && row) stats.totalLabOrders = row.totalLabOrders;
          db.get(`SELECT COUNT(*) as pendingLabOrders FROM lab_orders WHERE status = 'ordered' OR status = 'processing'`, (err, row) => {
            if (!err && row) stats.pendingLabOrders = row.pendingLabOrders;
            db.get(`SELECT COUNT(*) as totalDispensing FROM pharmacy_dispensing`, (err, row) => {
              if (!err && row) stats.totalDispensing = row.totalDispensing;
              db.get(`SELECT COUNT(*) as totalAppointments FROM appointments`, (err, row) => {
                if (!err && row) stats.totalAppointments = row.totalAppointments;
                db.get(`SELECT COUNT(*) as scheduledAppointments FROM appointments WHERE status = 'scheduled'`, (err, row) => {
                  if (!err && row) stats.scheduledAppointments = row.scheduledAppointments;
                  db.get(`SELECT COUNT(*) as totalNotifications FROM notifications`, (err, row) => {
                    if (!err && row) stats.totalNotifications = row.totalNotifications;
                    db.get(`SELECT COUNT(*) as unreadNotifications FROM notifications WHERE read_at IS NULL`, (err, row) => {
                      if (!err && row) stats.unreadNotifications = row.unreadNotifications;
                      db.get(`SELECT COUNT(*) as totalInventory FROM inventory`, (err, row) => {
                        if (!err && row) stats.totalInventory = row.totalInventory;
                        db.get(`SELECT COUNT(*) as lowStockItems FROM inventory WHERE current_stock <= reorder_level`, (err, row) => {
                          if (!err && row) stats.lowStockItems = row.lowStockItems;
                          db.get(`SELECT COUNT(*) as totalReferrals FROM referrals`, (err, row) => {
                            if (!err && row) stats.totalReferrals = row.totalReferrals;
                            db.get(`SELECT COUNT(*) as pendingReferrals FROM referrals WHERE status = 'pending'`, (err, row) => {
                              if (!err && row) stats.pendingReferrals = row.pendingReferrals;
                              return sendSecureJSON(res, 200, { ok: true, stats });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

function handleList(req, res) {
  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const period = params.get('period') || 'month';
  const metric = params.get('metric') || 'encounters';

  let sql = `SELECT a.id, a.metric, a.value, a.period, a.recorded_at FROM analytics a WHERE 1=1`;
  const args = [];
  if (period) { sql += ` AND a.period = ?`; args.push(period); }
  if (metric) { sql += ` AND a.metric = ?`; args.push(metric); }
  sql += ` ORDER BY a.recorded_at DESC LIMIT 100`;

  db.all(sql, args, (err, rows) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Analytics List Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
    }
    return sendSecureJSON(res, 200, { ok: true, analytics: rows || [] });
  });
}

function handleCreate(req, res) {
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
