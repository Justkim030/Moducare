#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const authController = require('./controllers/authController');
const db = require('./config/db');

// Load environment variables for PORT and DATABASE_URL
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
  // Directory Traversal Defense Check
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

const server = http.createServer((req, res) => {
  // Clear trace fingerprint headers
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  const url = decodeURIComponent(req.url.split('?')[0]);

  // Clean, explicit API Route Gates
  if (url.startsWith('/api/')) {
    if (url === '/api/register' && req.method === 'POST') {
      return authController.handleRegister(req, res);
    }
    
    if (url === '/api/login' && req.method === 'POST') {
      return authController.handleLogin(req, res);
    }
    
    if (url === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Endpoint unavailable.' }));
  }

  // Serve static UI assets directly from root folder path
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