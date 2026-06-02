#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

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

// Parse Database Path from Connection URL (e.g., sqlite://src/data/hospital.db)
let dbPath;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('sqlite://')) {
  const relativeDbPath = dbUrl.replace('sqlite://', '');
  dbPath = path.resolve(ROOT, relativeDbPath);
} else {
  dbPath = path.join(ROOT, 'src', 'data', 'hospital.db');
}

// Ensure the parent directory for the database exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database file via URL configuration at:', dbPath);
});

function sendJSON(res, status, obj) {
  const s = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(s),
  });
  res.end(s);
}

function serveFile(filePath, res) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return serveIndex(res);
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function serveIndex(res) {
  const index = path.join(ROOT, 'index.html');
  fs.readFile(index, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('index.html not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

function readBody(req, cb) {
  let body = '';
  req.on('data', (ch) => (body += ch));
  req.on('end', () => {
    try {
      cb(null, JSON.parse(body || '{}'));
    } catch (e) {
      cb(e);
    }
  });
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url.startsWith('/api/')) {
    if (req.method === 'GET' && url === '/api/health') return sendJSON(res, 200, { ok: true });

    // Generic GET across SQLite-mapped tables
    const tables = ['users', 'activities', 'analytics', 'appointments', 'finance', 'operations', 'incidents'];
    const matchedTable = tables.find((t) => url === `/api/${t}`);

    if (req.method === 'GET' && matchedTable) {
      db.all(`SELECT * FROM ${matchedTable}`, [], (err, rows) => {
        if (err) return sendJSON(res, 500, { ok: false, error: 'Database read failure' });
        if (matchedTable === 'users') {
          rows.forEach((u) => delete u.passwordHash); // never leak hash
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(rows));
      });
      return;
    }

    if (req.method === 'POST' && url === '/api/incidents') {
      return readBody(req, (err, p) => {
        if (err) return sendJSON(res, 400, { ok: false, error: 'invalid json' });
        const created = new Date().toISOString();
        db.run(
          `INSERT INTO incidents (created, title, description, status, severity) VALUES (?, ?, ?, ?, ?)` ,
          [
            created,
            p.title || '',
            p.description || '',
            p.status || 'open',
            p.severity || 'low',
          ],
          function (writeErr) {
            if (writeErr) return sendJSON(res, 500, { ok: false, error: 'Write failure' });
            return sendJSON(res, 201, {
              ok: true,
              incident: Object.assign({ id: this.lastID, created }, p),
            });
          }
        );
      });
    }

    if (req.method === 'POST' && url === '/api/login') {
      return readBody(req, (err, p) => {
        if (err) return sendJSON(res, 400, { ok: false, error: 'invalid json' });
        const { email, password } = p;
        if (!email || !password) return sendJSON(res, 400, { ok: false, error: 'Credentials missing' });

        db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email], (getErr, user) => {
          if (getErr || !user) return sendJSON(res, 401, { ok: false, error: 'Invalid credentials' });

          if (user.passwordHash) {
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            if (user.passwordHash !== hash) return sendJSON(res, 401, { ok: false, error: 'Invalid credentials' });
          }

          const safe = Object.assign({}, user);
          delete safe.passwordHash;
          return sendJSON(res, 200, { ok: true, user: safe });
        });
      });
    }

    if (req.method === 'POST' && url === '/api/register') {
      return readBody(req, (err, p) => {
        if (err) return sendJSON(res, 400, { ok: false, error: 'invalid json' });
        const { name, email, role, password } = p;
        if (!email || !password) return sendJSON(res, 400, { ok: false, error: 'Email and password required' });

        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        const userId = 'usr_' + Date.now();

        db.run(
          'INSERT INTO users (id, name, email, role, passwordHash) VALUES (?, ?, ?, ?, ?)',
          [userId, name || email, email, role || 'staff', passwordHash],
          function (writeErr) {
            if (writeErr) {
              if (writeErr.message && writeErr.message.includes('UNIQUE')) {
                return sendJSON(res, 400, { ok: false, error: 'Email already registered' });
              }
              return sendJSON(res, 500, { ok: false, error: 'Registration failed' });
            }
            return sendJSON(res, 201, { ok: true, user: { id: userId, name: name || email, email, role } });
          }
        );
      });
    }

    if ((req.method === 'PUT' || req.method === 'DELETE') && url.startsWith('/api/users/')) {
      const idPart = url.replace('/api/users/', '');

      if (req.method === 'DELETE') {
        db.run('DELETE FROM users WHERE id = ?', [idPart], (err) => {
          if (err) return sendJSON(res, 500, { ok: false, error: 'Delete execution failed' });
          return sendJSON(res, 200, { ok: true });
        });
        return;
      }

      if (req.method === 'PUT') {
        return readBody(req, (err, payload) => {
          if (err) return sendJSON(res, 400, { ok: false, error: 'invalid json' });

          db.get('SELECT * FROM users WHERE id = ?', [idPart], (getErr, user) => {
            if (getErr || !user) return sendJSON(res, 404, { ok: false, error: 'User not found' });

            let updatedHash = user.passwordHash;
            if (payload.password) {
              updatedHash = crypto.createHash('sha256').update(payload.password).digest('hex');
            }

            const name = payload.name !== undefined ? payload.name : user.name;
            const email = payload.email !== undefined ? payload.email : user.email;
            const role = payload.role !== undefined ? payload.role : user.role;

            db.run(
              'UPDATE users SET name = ?, email = ?, role = ?, passwordHash = ? WHERE id = ?',
              [name, email, role, updatedHash, idPart],
              function (updateErr) {
                if (updateErr) return sendJSON(res, 500, { ok: false, error: 'Update failed' });
                return sendJSON(res, 200, { ok: true, user: { id: idPart, name, email, role } });
              }
            );
          });
        });
      }
    }

    return sendJSON(res, 404, { error: 'Endpoint not found' });
  }

  // SPA fallback for frontend routes
  const filePath = path.join(ROOT, url === '/' ? '/index.html' : url);
  serveFile(filePath, res);
});

process.on('SIGINT', () => {
  db.close(() => {
    console.log('Database connection closed safely.');
    process.exit(0);
  });
});

server.listen(PORT, () => console.log(`Server handling SQLite file running at http://localhost:${PORT}`));

