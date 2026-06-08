#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const authController = require('./controllers/authController');
const db = require('./config/db');

// Load environment variables
require('dotenv').config();

const PORT = process.env.PORT || 8081;
const ROOT = process.cwd();

// Fallback to 'api' if the env variable isn't defined yet
const API_PREFIX = process.env.API_SECRET_PREFIX || 'api';

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

const server = http.createServer((req, res) => {
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  const url = decodeURIComponent(req.url.split('?')[0]);

  // Dynamically extract the first segment of the URL path
  const urlSegments = url.split('/').filter(Boolean); 
  const currentPrefix = urlSegments[0]; // e.g., if url is /api/login, this is 'api'

  // Match against your completely hidden environment token
  if (currentPrefix === API_PREFIX) {
    const actionRoute = `/${urlSegments.slice(1).join('/')}`; // Extracts 'register' or 'login'

    if (actionRoute === '/register' && req.method === 'POST') {
      return authController.handleRegister(req, res);
    }
    
    if (actionRoute === '/login' && req.method === 'POST') {
      return authController.handleLogin(req, res);
    }
    
    if (actionRoute === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // Hide existence of any other endpoint
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Endpoint hidden or unavailable.' }));
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
  console.log(` Secure ModuCare Application Engine active.`);
  console.log(` Masked Gateway Active: /${API_PREFIX}/<route>`);
});
