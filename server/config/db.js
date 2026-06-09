const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const ROOT = process.cwd();
let dbPath = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite://')
  ? path.resolve(ROOT, process.env.DATABASE_URL.replace('sqlite://', ''))
  : path.join(ROOT, 'src', 'data', 'hospital.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  // Enforce foreign key constraints across all controllers automatically
  db.run("PRAGMA foreign_keys = ON;");
});

module.exports = db;