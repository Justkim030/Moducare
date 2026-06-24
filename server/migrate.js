#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

require('dotenv').config();

const ROOT = process.cwd();
let dbPath = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite://')
  ? path.resolve(ROOT, process.env.DATABASE_URL.replace('sqlite://', ''))
  : path.join(ROOT, 'src', 'data', 'hospital.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) { console.error('Database connection error:', err.message); process.exit(1); }
  db.run("PRAGMA foreign_keys = ON;", () => executeSchemaMigration());
});

function executeSchemaMigration() {
  db.serialize(() => {
    console.log('\n--- Dropping existing database elements for clean migration ---');
    db.run(`DROP TABLE IF EXISTS external_incidents`);
    db.run(`DROP TABLE IF EXISTS internal_incidents`);
    db.run(`DROP TABLE IF EXISTS incidents`);
    db.run(`DROP TABLE IF EXISTS operations`);
    db.run(`DROP TABLE IF EXISTS activities`);
    db.run(`DROP TABLE IF EXISTS finance`);
    db.run(`DROP TABLE IF EXISTS appointments`);
    db.run(`DROP TABLE IF EXISTS patients`);
    db.run(`DROP TABLE IF EXISTS employees`);
    db.run(`DROP TABLE IF EXISTS roles`);
    db.run(`DROP TABLE IF EXISTS departments`);
    db.run(`DROP TABLE IF EXISTS users`);

    console.log('\n--- Instantiating tables matching locked ER diagram ---');

    // 1. Users (Credentials only)
    db.run(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone_number TEXT,
      passwordHash TEXT
    )`);

    // 2. Departments
    db.run(`CREATE TABLE departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`);

    // 3. Roles
    db.run(`CREATE TABLE roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department_id TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    )`);

    // 4. Employees (Linked 1:1 to users via user_id; can be NULL)
    db.run(`CREATE TABLE employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT UNIQUE,
      role_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    )`);

    // 5. Patients
    db.run(`CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone_number TEXT
    )`);

    // 6. Appointments
    db.run(`CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      type TEXT,
      status TEXT,
      employee_id TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    // 7. Finance
    db.run(`CREATE TABLE finance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      reference TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      date TEXT,
      due TEXT,
      employee_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )`);

    // 8. Activities (Correctly mapped to employee_id)
    db.run(`CREATE TABLE activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      priority TEXT,
      due TEXT,
      status TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    // 9. Operations
    db.run(`CREATE TABLE operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      department TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'referred',
      assignee TEXT,
      due TEXT,
      tags TEXT,
      notes TEXT,
      employee_id TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    // 10. Incidents
    db.run(`CREATE TABLE incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      employee_id TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    // 11. Internal Incidents (Inheritance subtype)
    db.run(`CREATE TABLE internal_incidents (
      incidents_id INTEGER PRIMARY KEY,
      department_id TEXT,
      FOREIGN KEY (incidents_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    )`);

    // 12. External Incidents (Inheritance subtype)
    db.run(`CREATE TABLE external_incidents (
      incidents_id INTEGER PRIMARY KEY,
      FOREIGN KEY (incidents_id) REFERENCES incidents(id) ON DELETE CASCADE
    )`);

    db.serialize(() => {
      console.log('\n--- Populating system base seed metrics ---');

      const hash = (pwd) => bcrypt.hashSync(pwd, 12);

      // Seed Users
      db.run(`INSERT INTO users (id, email, phone_number, passwordHash) VALUES 
        ('usr_admin', 'alice@acme.org', '+254700000000', '${hash('admin123')}'),
        ('usr_dan', 'danreech@acme.org', '+254711111111', '${hash('dan123')}')`);

      // Seed Departments & Roles
      db.run(`INSERT INTO departments (id, name) VALUES ('dept_tech', 'IT Engineering'), ('dept_clin', 'Clinical Services')`);
      db.run(`INSERT INTO roles (id, name, department_id) VALUES ('role_dev', 'Systems Engineer', 'dept_tech'), ('role_nurse', 'Triage Practitioner', 'dept_clin'), ('role_admin', 'Administrator', 'dept_tech')`);

      // Seed Employees
      db.run(`INSERT OR IGNORE INTO employees (id, name, user_id, role_id) VALUES 
        ('emp_admin', 'Alice Admin', 'usr_admin', 'role_admin'),
        ('emp_dan', 'Daniel Mach Reech', 'usr_dan', 'role_dev'),
        ('emp_field_worker', 'John Staff (No Portal Account)', null, 'role_nurse')`);

      // Seed Patients
      db.run(`INSERT INTO patients (id, name, email, phone_number) VALUES 
        ('pat_1', 'Jane Doe', 'jane@gmail.com', '+254722222222')`);

      // Seed Operations
      db.run(`INSERT INTO operations (title, description, department, priority, status, assignee, due, tags, notes, employee_id) VALUES 
        ('Update service agreements for Q1', 'Coordinate with Finance.', 'Operations', 'high', 'active', 'Marcus Rivera', '2025-01-18', '["agreement","billing"]', '', 'emp_dan'),
        ('Conduct new hire orientation', '', 'HR', 'medium', 'referred', 'Alex Liu', '2025-01-28', '["onboarding"]', '', 'emp_admin'),
        ('Monthly compliance audit report', 'Requires director sign-off.', 'Audit', 'high', 'pending', 'Priya Joshi', '2025-01-22', '["compliance","report"]', '', 'emp_dan'),
        ('Process timesheets for Dec payroll', '', 'Finance', 'urgent', 'active', 'Sara Okonkwo', '2025-01-10', '["payroll","timesheet"]', '', 'emp_dan'),
        ('Deploy staff portal update v2.1', 'Completed on schedule.', 'System Admin', 'medium', 'completed', 'Jane Doe', '2025-01-05', '["system","deploy"]', '', 'emp_admin'),
        ('Renew annual insurance certificates', '', 'Operations', 'high', 'referred', 'Derek Walsh', '2025-02-01', '["insurance","renewal"]', '', 'emp_dan'),
        ('Analytics dashboard data refresh', '', 'Analytics', 'low', 'pending', 'Tomas Guerrero', '2025-01-25', '["analytics"]', '', 'emp_admin'),
        ('Archive inactive client records', '', 'Document Vault', 'low', 'completed', 'Mei Tanaka', '2025-01-08', '["archive","records"]', '', 'emp_admin'),
        ('Staff skills assessment rollout', '', 'HR', 'medium', 'active', 'Alex Liu', '2025-02-10', '["training"]', '', 'emp_admin'),
        ('Quarterly board meeting prep', 'Slides due 3 days before.', 'Operations', 'urgent', 'active', 'Marcus Rivera', '2025-01-30', '["meeting","exec"]', '', 'emp_dan')`);

      // Seed Core Relational Elements
      db.run(`INSERT INTO appointments (time, patient_id, type, status, employee_id) VALUES 
        ('2026-06-15T10:00:00Z', 'pat_1', 'Consultation', 'scheduled', 'emp_field_worker')`);

      db.run(`INSERT INTO finance (type, reference, amount, status, date, due, employee_id, patient_id) VALUES 
        ('Invoice', 'INV-2026-001', 4500.00, 'pending', '2026-06-08', '2026-06-22', 'emp_dan', 'pat_1')`);

      db.run(`INSERT INTO activities (time, employee_id, action, details, priority, due, status) VALUES 
        ('2026-06-08T10:15:00Z', 'emp_field_worker', 'Field Assessment', 'Completed physical check', 'medium', null, 'completed')`);

      // Seed Incidents Subtype Inheritances
      db.run(`INSERT INTO incidents (id, created, title, description, status, severity, employee_id) VALUES 
        (101, '2026-06-08T09:00:00Z', 'Database Interruption', 'Minor replication gap', 'resolved', 'low', 'emp_dan'),
        (102, '2026-06-08T11:30:00Z', 'External Power Spike', 'Transformer burst outside gate', 'open', 'critical', 'emp_dan')`);

      db.run(`INSERT INTO internal_incidents (incidents_id, department_id) VALUES (101, 'dept_tech')`);
      db.run(`INSERT INTO external_incidents (incidents_id) VALUES (102)`);

      console.log('✓ Mock transactional items completely loaded.');
    });
  });

  db.close((err) => {
    if (err) console.error(err.message);
    console.log('\n🚀 Success! Database migration applied clean and successfully!');
  });
}