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
const db = require('./config/db');

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

const AUTH_ROLES  = ['role_dev', 'role_nurse', 'admin', 'role_admin', 'staff', 'lead', 'supervisor', 'director'];
const ADMIN_ROLES = ['role_dev', 'admin', 'role_admin'];

function enforceRole(allowedRoles, handler) {
  return function(req, res) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return sendSecureJSON(res, 401, { ok: false, error: 'Authentication required.' });
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch (e) {
      return sendSecureJSON(res, 401, { ok: false, error: 'Invalid token.' });
    }

    const roleId = payload.role_id;
    if (!roleId || !allowedRoles.includes(roleId)) {
      return sendSecureJSON(res, 403, { ok: false, error: 'Forbidden: insufficient permissions.' });
    }

    req.user = {
      id: payload.id,
      role_id: roleId,
      employee_id: payload.employee_id,
      name: payload.name,
      email: payload.email
    };
    return handler(req, res);
  };
}

const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  
  if (Date.now() - attempts.lastAttempt < 60000 && attempts.count >= 5) {
    return sendSecureJSON(res, 429, { ok: false, error: 'Too many login attempts. Try again in 60 seconds.' });
  }
  
  loginAttempts.set(key, { count: attempts.count + 1, lastAttempt: Date.now() });
  next();
}

const server = http.createServer((req, res) => {
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url.startsWith('/api/')) {
    if (url === '/api/register' && req.method === 'POST') {
      return authController.handleRegister(req, res);
    }

    if (url === '/api/login' && req.method === 'POST') {
      return rateLimitLogin(req, res, () => authController.handleLogin(req, res));
    }

    if (url === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (url.startsWith('/api/users')) {
      if (req.method === 'GET') return enforceRole(ADMIN_ROLES, usersController.handleList)(req, res);
      if (req.method === 'POST') return enforceRole(ADMIN_ROLES, usersController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/users\/[^/]+$/)) return enforceRole(ADMIN_ROLES, usersController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/users\/[^/]+$/)) return enforceRole(ADMIN_ROLES, usersController.handleDelete)(req, res);
    }

    if (url.startsWith('/api/patients')) {
      if (req.method === 'GET' && url.match(/\/api\/patients\/[^/]+$/)) return enforceRole(AUTH_ROLES, patientsController.handleGet)(req, res);
      if (req.method === 'GET' && url === '/api/patients') return enforceRole(AUTH_ROLES, patientsController.handleList)(req, res);
      if (req.method === 'POST' && url === '/api/patients') return enforceRole(AUTH_ROLES, patientsController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/patients\/[^/]+$/)) return enforceRole(AUTH_ROLES, patientsController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/patients\/[^/]+$/)) return enforceRole(AUTH_ROLES, patientsController.handleDelete)(req, res);
    }

    if (url.startsWith('/api/appointments')) {
      if (req.method === 'GET' && url.match(/\/api\/appointments\/[^/]+$/)) return enforceRole(AUTH_ROLES, appointmentsController.handleGet)(req, res);
      if (req.method === 'GET' && url === '/api/appointments') return enforceRole(AUTH_ROLES, appointmentsController.handleList)(req, res);
      if (req.method === 'POST' && url === '/api/appointments') return enforceRole(AUTH_ROLES, appointmentsController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/appointments\/[^/]+$/)) return enforceRole(AUTH_ROLES, appointmentsController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/appointments\/[^/]+$/)) return enforceRole(AUTH_ROLES, appointmentsController.handleDelete)(req, res);
    }

    if (url.startsWith('/api/incidents')) {
      if (req.method === 'GET' && url.match(/\/api\/incidents\/[^/]+$/)) return enforceRole(AUTH_ROLES, incidentsController.handleGet)(req, res);
      if (req.method === 'GET' && url === '/api/incidents') return enforceRole(AUTH_ROLES, incidentsController.handleList)(req, res);
      if (req.method === 'POST' && url === '/api/incidents') return enforceRole(AUTH_ROLES, incidentsController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/incidents\/[^/]+$/)) return enforceRole(AUTH_ROLES, incidentsController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/incidents\/[^/]+$/)) return enforceRole(AUTH_ROLES, incidentsController.handleDelete)(req, res);
    }

    if (url.startsWith('/api/finance')) {
      if (req.method === 'GET' && url.match(/\/api\/finance\/[^/]+$/)) return enforceRole(AUTH_ROLES, financeController.handleGet)(req, res);
      if (req.method === 'GET' && url === '/api/finance') return enforceRole(AUTH_ROLES, financeController.handleList)(req, res);
      if (req.method === 'POST' && url === '/api/finance') return enforceRole(AUTH_ROLES, financeController.handleCreate)(req, res);
      if (req.method === 'PUT' && url.match(/\/api\/finance\/[^/]+$/)) return enforceRole(AUTH_ROLES, financeController.handleUpdate)(req, res);
      if (req.method === 'DELETE' && url.match(/\/api\/finance\/[^/]+$/)) return enforceRole(AUTH_ROLES, financeController.handleDelete)(req, res);
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Endpoint unavailable.' }));
  }

  const filePath = path.join(ROOT, url === '/' ? '/index.html' : url);
  serveFile(filePath, res);
});

process.on('SIGINT', () => {
  db.close(() => {
    console.log('\nDatabase connection closed safely.');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Secure ModuCare Application Engine active.`);
  console.log(`📂 Serving plain assets directly from root directory.`);
  console.log(`👉 Access dashboard at: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
