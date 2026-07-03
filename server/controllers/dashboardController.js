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

function handleDashboard(req, res) {
  const stats = {};
  
  db.get(`SELECT COUNT(*) as value FROM operations WHERE status = 'active'`, (err, row) => {
    stats.tasks = row && !err ? row.value : 0;
    db.get(`SELECT COUNT(*) as value FROM appointments WHERE status = 'scheduled'`, (err, row) => {
      stats.appointments = row && !err ? row.value : 0;
      db.get(`SELECT COUNT(*) as value FROM patients`, (err, row) => {
        stats.patients = row && !err ? row.value : 0;
        db.get(`SELECT COUNT(*) as value FROM incidents WHERE status != 'Closed'`, (err, row) => {
          stats.incidents = row && !err ? row.value : 0;
          db.get(`SELECT COUNT(*) as value FROM notifications WHERE read_at IS NULL`, (err, row) => {
            stats.notifications = row && !err ? row.value : 0;
            db.get(`SELECT COUNT(*) as value FROM documents`, (err, row) => {
              stats.documents = row && !err ? row.value : 0;
              db.get(`SELECT COUNT(*) as value FROM operations WHERE status = 'pending'`, (err, row) => {
                stats.teamTasks = row && !err ? row.value : 0;
                db.get(`SELECT COUNT(*) as value FROM operations`, (err, row) => {
                  stats.totalOperations = row && !err ? row.value : 0;
                  db.get(`SELECT COUNT(*) as value FROM incidents`, (err, row) => {
                    stats.totalIncidents = row && !err ? row.value : 0;
                    db.get(`SELECT COUNT(*) as value FROM users`, (err, row) => {
                      stats.users = row && !err ? row.value : 0;
                      db.get(`SELECT COUNT(*) as value FROM audit`, (err, row) => {
                        stats.audit = row && !err ? row.value : 0;
                        db.get(`SELECT SUM(amount) as value FROM finance WHERE status = 'pending'`, (err, row) => {
                          stats.finance = row && !err && row.value ? row.value : 0;
                          db.get(`SELECT COUNT(*) as value FROM employees`, (err, row) => {
                            stats.staffCount = row && !err ? row.value : 0;
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
}

module.exports = { handleDashboard };