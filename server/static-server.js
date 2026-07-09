#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const authController = require('./controllers/authController');
const usersController = require('./controllers/usersController');
const patientsController = require('./controllers/patientsController');
const appointmentsController = require('./controllers/appointmentsController');
const incidentsController = require('./controllers/incidentController');
const financeController = require('./controllers/financeController');
const operationsController = require('./controllers/operationsController');
const analyticsController = require('./controllers/analyticsController');
const activitiesController = require('./controllers/activitiesController');
const dashboardController = require('./controllers/dashboardController');
const labOrdersController = require('./controllers/labOrdersController');
const encountersController = require('./controllers/encountersController');
const notificationsController = require('./controllers/notificationsController');
const documentsController = require('./controllers/documentsController');
const pharmacyController = require('./controllers/pharmacyController');
const referralsController = require('./controllers/referralsController');
const inventoryController = require('./controllers/inventoryController');
const eventsController = require('./controllers/eventsController');
const auditController = require('./controllers/auditController');
const { checkRateLimit, resetRateLimit, checkBodySize } = require('./middleware/rateLimit');
const { hasCapability } = require('./config/permissions');
const db = require('./config/db');
const { runMigration } = require('./migrate');

require('dotenv').config();

const PORT = process.env.PORT || 8081;
const ROOT = process.cwd();

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function serveFile(filePath, res) {
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access denied.');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return serveIndex(res);
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 
      'Content-Type': type, 
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function serveIndex(res) {
  const index = path.join(ROOT, 'index.html');
  fs.readFile(index, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('System execution anomaly.');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html', 'X-Frame-Options': 'DENY' });
    res.end(data);
  });
}

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

// RBAC Enforcement

const { verifyToken } = require('./utils/jwt');

const AUTH_ROLES  = ['role_dev', 'role_nurse', 'role_admin', 'role_lead', 'role_supervisor', 'role_director', 'role_finance'];
const ADMIN_ROLES = ['role_admin'];

function enforceRole(allowedRoles, handler) {
  return function(req, res) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return sendSecureJSON(res, 401, { ok: false, error: 'Invalid or expired token.' });
    }

    const roleId = payload.role_id;
    if (!roleId || !allowedRoles.includes(roleId)) {
      return sendSecureJSON(res, 403, { ok: false, error: 'Insufficient permissions.' });
    }

    req.user = payload;
    return handler(req, res);
  };
}

// Level 2 (Functional) enforcement: requires a specific capability on top of
// role membership. Compose after enforceRole, e.g.
//   enforceRole(AUTH_ROLES, enforceCapability('patient:write', ctrl.handleCreate))
function enforceCapability(capability, handler) {
  return function(req, res) {
    const roleId = req.user && req.user.role_id;
    if (!roleId || !hasCapability(roleId, capability)) {
      return sendSecureJSON(res, 403, { ok: false, error: 'Missing required permission: ' + capability });
    }
    return handler(req, res);
  };
}

function logPHIAccess(req, action, details, resourceType) {
  const payload = req.user || {};
  db.run(`INSERT INTO audit (user_id, action, details, resource_type, status, ip_address, user_agent) VALUES (?, ?, ?, ?, 'success', ?, ?)`,
    [payload.id || null, action, details || '', resourceType || '', req.ip || '', req.headers['user-agent'] || ''],
    (err) => { if (err) console.error(`[AUDIT] Log failed: ${err.message}`); }
  );
}

const server = http.createServer((req, res) => {
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  let url;
  try {
    url = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' });
    return res.end(JSON.stringify({ error: 'Malformed request URL.' }));
  }

  if (url.startsWith('/api/')) {
    if (url === '/api/register' && req.method === 'POST') {
      const rl = checkRateLimit(req);
      if (!rl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) });
        return res.end(JSON.stringify({ ok: false, error: 'Too many requests. Please try again later.' }));
      }
      checkBodySize(req, res, 512 * 1024);
      return authController.handleRegister(req, res);
    }

    if (url === '/api/login' && req.method === 'POST') {
      const rl = checkRateLimit(req);
      if (!rl.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) });
        return res.end(JSON.stringify({ ok: false, error: 'Too many login attempts. Please try again later.' }));
      }
      checkBodySize(req, res, 512 * 1024);
      return authController.handleLogin(req, res);
    }

    if (url === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if ((req.method === 'POST' || req.method === 'PUT') && !url.startsWith('/api/documents')) {
      checkBodySize(req, res, 1024 * 1024);
    }

    if (url.startsWith('/api/users')) {
      if (req.method === 'GET') return enforceRole(ADMIN_ROLES, usersController.handleList)(req, res);
      if (req.method === 'POST') return enforceRole(ADMIN_ROLES, usersController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/users\/[^/]+$/)) return enforceRole(ADMIN_ROLES, usersController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/users\/[^/]+$/)) return enforceRole(ADMIN_ROLES, usersController.handleDelete)(req, res);
    }

    if (url.startsWith('/api/patients')) {
      if (req.method === 'GET' && url.match(/\/api\/patients\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:read', patientsController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/patients') return enforceRole(AUTH_ROLES, enforceCapability('patient:read', patientsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/patients') return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', patientsController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/patients\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', patientsController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/patients\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', patientsController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/appointments')) {
      if (req.method === 'GET' && url.match(/\/api\/appointments\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('appointment:read', appointmentsController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/appointments') return enforceRole(AUTH_ROLES, enforceCapability('appointment:read', appointmentsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/appointments') return enforceRole(AUTH_ROLES, enforceCapability('appointment:write', appointmentsController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/appointments\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('appointment:write', appointmentsController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/appointments\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('appointment:write', appointmentsController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/incidents')) {
      if (req.method === 'GET' && url.match(/\/api\/incidents\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('incident:read', incidentsController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/incidents') return enforceRole(AUTH_ROLES, enforceCapability('incident:read', incidentsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/incidents') return enforceRole(AUTH_ROLES, enforceCapability('incident:write', incidentsController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/incidents\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('incident:write', incidentsController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/incidents\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('incident:write', incidentsController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/finance')) {
      if (req.method === 'GET' && url.match(/\/api\/finance\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('finance:read', financeController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/finance') return enforceRole(AUTH_ROLES, enforceCapability('finance:read', financeController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/finance') return enforceRole(AUTH_ROLES, enforceCapability('finance:write', financeController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/finance\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('finance:write', financeController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/finance\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('finance:write', financeController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/operations')) {
      if (req.method === 'GET' && url.match(/\/api\/operations\/[^/]+$/)) return enforceRole(AUTH_ROLES, operationsController.handleGet)(req, res);
      if (req.method === 'GET' && url === '/api/operations') return enforceRole(AUTH_ROLES, operationsController.handleList)(req, res);
      if (req.method === 'POST' && url === '/api/operations') return enforceRole(AUTH_ROLES, operationsController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/operations\/[^/]+$/)) return enforceRole(AUTH_ROLES, operationsController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/operations\/[^/]+$/)) return enforceRole(AUTH_ROLES, operationsController.handleDelete)(req, res);
    }

    if (url.startsWith('/api/encounters')) {
      if (req.method === 'GET' && url.match(/\/api\/encounters\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('encounter:read', encountersController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/encounters') return enforceRole(AUTH_ROLES, enforceCapability('encounter:read', encountersController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/encounters') return enforceRole(AUTH_ROLES, enforceCapability('encounter:write', encountersController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/encounters\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('encounter:write', encountersController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/encounters\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('encounter:write', encountersController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/lab-orders')) {
      if (req.method === 'GET' && url.match(/\/api\/lab-orders\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('lab:read', labOrdersController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/lab-orders') return enforceRole(AUTH_ROLES, enforceCapability('lab:read', labOrdersController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/lab-orders') return enforceRole(AUTH_ROLES, enforceCapability('lab:order', labOrdersController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/lab-orders\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('lab:result_entry', labOrdersController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/lab-orders\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('lab:order', labOrdersController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/pharmacy')) {
      if (req.method === 'GET' && url.match(/\/api\/pharmacy\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('pharmacy:inventory_read', pharmacyController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/pharmacy') return enforceRole(AUTH_ROLES, enforceCapability('pharmacy:inventory_read', pharmacyController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/pharmacy') return enforceRole(AUTH_ROLES, enforceCapability('pharmacy:dispense', pharmacyController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/pharmacy\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('pharmacy:dispense', pharmacyController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/pharmacy\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('pharmacy:dispense', pharmacyController.handleDelete))(req, res);
    }

    // Notifications
    if (url.startsWith('/api/notifications')) {
      if (req.method === 'GET' && url.match(/\/api\/notifications\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('communication:read', notificationsController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/notifications') return enforceRole(AUTH_ROLES, enforceCapability('communication:read', notificationsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/notifications') return enforceRole(AUTH_ROLES, enforceCapability('communication:write', notificationsController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/notifications\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('communication:write', notificationsController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/notifications\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('communication:write', notificationsController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/documents')) {
      if (req.method === 'GET' && url.match(/\/api\/documents\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:read', documentsController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/documents') return enforceRole(AUTH_ROLES, enforceCapability('patient:read', documentsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/documents') return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', documentsController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/documents\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', documentsController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/documents\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', documentsController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/referrals')) {
      if (req.method === 'GET' && url.match(/\/api\/referrals\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('patient:read', referralsController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/referrals') return enforceRole(AUTH_ROLES, enforceCapability('patient:read', referralsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/referrals') return enforceRole(AUTH_ROLES, enforceCapability('referral:write', referralsController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/referrals\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('referral:write', referralsController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/referrals\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('referral:write', referralsController.handleDelete))(req, res);
    }

    if (url.startsWith('/api/audit')) {
      if (req.method === 'GET' && url === '/api/audit') return enforceRole(AUTH_ROLES, enforceCapability('audit:read', auditController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/audit') return enforceRole(AUTH_ROLES, enforceCapability('audit:read', auditController.handleCreate))(req, res);
    }

    if (url.startsWith('/api/inventory')) {
      if (req.method === 'GET' && url.match(/\/api\/inventory\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('inventory:read', inventoryController.handleGet))(req, res);
      if (req.method === 'GET' && url === '/api/inventory') return enforceRole(AUTH_ROLES, enforceCapability('inventory:read', inventoryController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/inventory') return enforceRole(AUTH_ROLES, enforceCapability('inventory:write', inventoryController.handleCreate))(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/inventory\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('inventory:write', inventoryController.handleUpdate))(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/inventory\/[^/]+$/)) return enforceRole(AUTH_ROLES, enforceCapability('inventory:write', inventoryController.handleDelete))(req, res);
      if (req.method === 'GET' && url === '/api/inventory/alerts') return enforceRole(AUTH_ROLES, enforceCapability('inventory:read', inventoryController.handleAlerts))(req, res);
    }

    if (url.startsWith('/api/analytics')) {
      if (req.method === 'GET' && url === '/api/analytics/overview') return enforceRole(AUTH_ROLES, enforceCapability('analytics:read', analyticsController.handleOverview))(req, res);
      if (req.method === 'GET' && url === '/api/analytics') return enforceRole(AUTH_ROLES, enforceCapability('analytics:read', analyticsController.handleList))(req, res);
      if (req.method === 'POST' && url === '/api/analytics') return enforceRole(AUTH_ROLES, enforceCapability('report:export', analyticsController.handleCreate))(req, res);
    }

    if (url.startsWith('/api/search')) {
      if (req.method === 'GET') return enforceRole(AUTH_ROLES, enforceCapability('patient:read', handleSearch))(req, res);
    }

    if (url.startsWith('/api/documents') && req.method === 'POST') {
      return enforceRole(AUTH_ROLES, enforceCapability('patient:write_demographics', handleDocumentUpload))(req, res);
    }

    if (url.startsWith('/api/reminders') && req.method === 'POST') {
      return enforceRole(AUTH_ROLES, enforceCapability('communication:write', handleReminderTrigger))(req, res);
    }

    if (url.startsWith('/api/activities')) {
      if (req.method === 'GET' && url === '/api/activities') return enforceRole(AUTH_ROLES, enforceCapability('analytics:read', activitiesController.handleList))(req, res);
    }

    if (url.startsWith('/api/dashboard')) {
      if (req.method === 'GET' && url === '/api/dashboard') return enforceRole(AUTH_ROLES, enforceCapability('dashboard:view', dashboardController.handleDashboard))(req, res);
    }

    if (url.startsWith('/api/events')) {
      if (req.method === 'GET' && url.match(/\/api\/events\/[^/]+$/)) return enforceRole(AUTH_ROLES, eventsController.handleGet)(req, res);
      if (req.method === 'GET' && url === '/api/events') return enforceRole(AUTH_ROLES, eventsController.handleList)(req, res);
      if (req.method === 'POST' && url === '/api/events') return enforceRole(AUTH_ROLES, eventsController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/events\/[^/]+$/)) return enforceRole(AUTH_ROLES, eventsController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/events\/[^/]+$/)) return enforceRole(AUTH_ROLES, eventsController.handleDelete)(req, res);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Endpoint unavailable.' }));
  }

  const filePath = path.join(ROOT, url === '/' ? '/index.html' : url);
  serveFile(filePath, res);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT] Recovered from unexpected error:', err && err.message);
});

process.on('SIGINT', () => {
  db.close(() => {
    console.log('\nDatabase connection closed safely.');
    process.exit(0);
  });
});

function handleSearch(req, res) {
  const q = req.url.split('?')[1] || '';
  const params = new URLSearchParams(q);
  const query = (params.get('q') || '').toLowerCase();
  const type = params.get('type') || 'all';

  if (!query || query.length < 2) {
    return sendSecureJSON(res, 400, { ok: false, error: 'Search query must be at least 2 characters.' });
  }

  let results = { patients: [], encounters: [], labOrders: [] };

  if (type === 'all' || type === 'patients') {
    db.all(`SELECT p.id, p.name, p.email, p.phone_number, p.dob, p.gender, p.county, p.hiv_status FROM patients p WHERE LOWER(p.name) LIKE ? OR LOWER(p.email) LIKE ? OR LOWER(p.phone_number) LIKE ? OR p.id LIKE ? LIMIT 20`, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`], (err, rows) => {
      if (!err && rows) results.patients = rows;
      if (type === 'patients') return sendSecureJSON(res, 200, { ok: true, ...results });
      if (type === 'all' || type === 'encounters') {
        db.all(`SELECT e.id, e.patient_id, e.encounter_date, e.visit_type, e.chief_complaint, p.name as patient_name FROM encounters e LEFT JOIN patients p ON p.id = e.patient_id WHERE LOWER(e.chief_complaint) LIKE ? OR LOWER(e.visit_type) LIKE ? OR LOWER(p.name) LIKE ? LIMIT 20`, [`%${query}%`, `%${query}%`, `%${query}%`], (err, rows) => {
          if (!err && rows) results.encounters = rows;
          if (type === 'encounters') return sendSecureJSON(res, 200, { ok: true, ...results });
          db.all(`SELECT lo.id, lo.patient_id, lo.test_type, lo.test_name, lo.status, lo.result_value, p.name as patient_name FROM lab_orders lo LEFT JOIN patients p ON p.id = lo.patient_id WHERE LOWER(lo.test_name) LIKE ? OR LOWER(lo.result_value) LIKE ? OR LOWER(p.name) LIKE ? LIMIT 20`, [`%${query}%`, `%${query}%`, `%${query}%`], (err, rows) => {
            if (!err && rows) results.labOrders = rows;
            return sendSecureJSON(res, 200, { ok: true, ...results });
          });
        });
      }
    });
  }
}

function handleDocumentUpload(req, res) {
  const formidable = require('formidable');
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(ROOT, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = new formidable.IncomingForm();
  form.uploadDir = uploadDir;
  form.keepExtensions = true;

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error(`[SECURE EXCEPTION] Document Upload Error: ${err.message}`);
      return sendSecureJSON(res, 500, { ok: false, error: 'Upload failed.' });
    }
    const file = files.file;
    const patientId = fields.patient_id;
    const docType = fields.doc_type || 'other';
    const fileName = fields.file_name || file.originalFilename || 'unknown';
    const fileSize = fs.statSync(file.path).size;

    db.run(`INSERT INTO documents (patient_id, doc_type, file_name, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
      [patientId || null, docType, fileName, fileSize, req.user?.id || null],
      function (err) {
        if (err) {
          console.error(`[SECURE EXCEPTION] Document DB Error: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Database error.' });
        }
        return sendSecureJSON(res, 201, { ok: true, document: { id: this.lastID, file_name: fileName, file_size: fileSize } });
      }
    );
  });
}

function handleReminderTrigger(req, res) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      const p = JSON.parse(body || '{}');
      const { type, channel } = p;

      db.all(`SELECT a.id, a.patient_id, a.reminder_due, a.reminder_sent, p.name as patient_name, p.phone_number FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE a.reminder_due IS NOT NULL AND a.reminder_sent = 0 AND a.status = 'scheduled' AND a.reminder_due <= datetime('now') LIMIT 50`, [], (err, rows) => {
        if (err) {
          console.error(`[SECURE EXCEPTION] Reminder Query Error: ${err.message}`);
          return sendSecureJSON(res, 500, { ok: false, error: 'Database error' });
        }
        const appointments = rows || [];
        const notifications = appointments.map(a => ({
          patient_id: a.patient_id,
          type: type || 'reminder',
          channel: channel || 'sms',
          subject: 'Appointment Reminder',
          body: `You have an appointment. Please confirm your attendance.`,
        }));

        let completed = 0;
        if (notifications.length === 0) {
          return sendSecureJSON(res, 200, { ok: true, sent: 0, message: 'No reminders due.' });
        }

        notifications.forEach(n => {
          db.run(`INSERT INTO notifications (patient_id, type, channel, subject, body, sent_by) VALUES (?, ?, ?, ?, ?, ?)`,
            [n.patient_id, n.type, n.channel, n.subject, n.body, req.user?.id || null],
            function (err) {
              completed++;
              if (completed === notifications.length) {
                const ids = appointments.map(a => a.id);
                db.run(`UPDATE appointments SET reminder_sent = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids, (upErr) => {
                  return sendSecureJSON(res, 200, { ok: true, sent: notifications.length });
                });
              }
            }
          );
        });
      });
    } catch (e) {
      return sendSecureJSON(res, 400, { ok: false, error: 'Malformed payload.' });
    }
  });
}

runMigration()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Secure ModuCare Application Engine active.`);
      console.log(`📂 Serving plain assets directly from root directory.`);
      console.log(`👉 Access dashboard at: http://localhost:${PORT}`);
      console.log(`======================================================\n`);
    });
  })
  .catch((err) => {
    console.error('Fatal: database migration failed, server not started.', err.message);
    process.exit(1);
  });

