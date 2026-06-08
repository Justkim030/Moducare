#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Load environment variables (.env)
require('dotenv').config();

const ROOT = process.cwd();

// Resolve target database path from .env connection URL
let dbPath;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl && dbUrl.startsWith('sqlite://')) {
  const relativeDbPath = dbUrl.replace('sqlite://', '');
  dbPath = path.resolve(ROOT, relativeDbPath);
} else {
  dbPath = path.join(ROOT, 'src', 'data', 'hospital.db');
}

// Ensure target directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Open Database Connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite file at: ${dbPath}`);
  executeSchemaMigration();
});

function executeSchemaMigration() {
  db.serialize(() => {
    console.log('\n--- Dropping outdated schema tables for clean migration ---');
    db.run(`DROP TABLE IF EXISTS incidents`);
    db.run(`DROP TABLE IF EXISTS analytics`);
    db.run(`DROP TABLE IF EXISTS activities`);
    db.run(`DROP TABLE IF EXISTS finance`);
    db.run(`DROP TABLE IF EXISTS appointments`);
    db.run(`DROP TABLE IF EXISTS patients`);
    db.run(`DROP TABLE IF EXISTS users`);

    console.log('\n--- Creating new normalized schema tables ---');

    // 1. Users Table
    db.run(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      passwordHash TEXT
    )`);

    // 2. Patients Table (NEW)
    db.run(`CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dob TEXT,
      gender TEXT,
      phone TEXT
    )`);

    // 3. Appointments Table (With Foreign Keys)
    db.run(`CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT,
      status TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // 4. Finance Table (With Foreign Key to Patient)
    db.run(`CREATE TABLE finance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reference TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      date TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )`);

    // 5. Activities Table (With Foreign Key to User)
    db.run(`CREATE TABLE activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      priority TEXT,
      due TEXT,
      status TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // 6. Analytics Table
    db.run(`CREATE TABLE analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      period TEXT NOT NULL
    )`);

    // 7. Incidents Table
    db.run(`CREATE TABLE incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      severity TEXT NOT NULL
    )`);

    // Ingest production-ready mock baseline dataset conforming to relations
    db.serialize(() => {
      console.log('\n--- Seeding relational data models ---');

      // Seed Users
      const users = [
        { id: "usr_admin", name: "Alice Admin", email: "alice@acme.org", role: "admin", passwordHash: null },
        { id: "usr_1779948492660", name: "Daniel Mach Reech", email: "danreech@acme.org", role: "admin", passwordHash: "ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f" },
        { id: "usr_1779963783364", name: "silvia korir", email: "korirsilvia44@gmail.com", role: "staff", passwordHash: "15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbcbf6c7c0938b8aa8" }
      ];
      const stmtUser = db.prepare("INSERT INTO users (id, name, email, role, passwordHash) VALUES (?, ?, ?, ?, ?)");
      users.forEach(u => stmtUser.run([u.id, u.name, u.email, u.role, u.passwordHash]));
      stmtUser.finalize();
      console.log(`✓ Seeded ${users.length} relational users.`);

      // Seed Patients
      const patients = [
        { id: "pat_1", name: "John Smith", dob: "1984-03-12", gender: "Male", phone: "+254711111111" },
        { id: "pat_2", name: "Mary Jones", dob: "1991-08-24", gender: "Female", phone: "+254722222222" },
        { id: "pat_3", name: "Peter Lee", dob: "1976-11-05", gender: "Male", phone: "+254733333333" }
      ];
      const stmtPat = db.prepare("INSERT INTO patients (id, name, dob, gender, phone) VALUES (?, ?, ?, ?, ?)");
      patients.forEach(p => stmtPat.run([p.id, p.name, p.dob, p.gender, p.phone]));
      stmtPat.finalize();
      console.log(`✓ Seeded ${patients.length} normalized patient profiles.`);

      // Seed Appointments
      const appointments = [
        { patient_id: "pat_1", doctor_id: "usr_1779948492660", time: "2026-06-10T10:00:00.000Z", type: "Consultation", status: "scheduled" },
        { patient_id: "pat_2", doctor_id: "usr_1779963783364", time: "2026-06-10T11:30:00.000Z", type: "Follow-up", status: "confirmed" },
        { patient_id: "pat_3", doctor_id: "usr_1779948492660", time: "2026-06-11T09:00:00.000Z", type: "Intake", status: "scheduled" }
      ];
      const stmtApp = db.prepare("INSERT INTO appointments (patient_id, doctor_id, time, type, status) VALUES (?, ?, ?, ?, ?)");
      appointments.forEach(a => stmtApp.run([a.patient_id, a.doctor_id, a.time, a.type, a.status]));
      stmtApp.finalize();
      console.log(`✓ Seeded ${appointments.length} linked clinical appointments.`);

      // Seed Finance
      const finance = [
        { patient_id: "pat_1", type: "Invoice", reference: "INV-1001", amount: 1200.00, status: "pending", date: "2026-06-01" },
        { patient_id: "pat_2", type: "Payment", reference: "PAY-2001", amount: 300.00, status: "posted", date: "2026-05-20" }
      ];
      const stmtFin = db.prepare("INSERT INTO finance (patient_id, type, reference, amount, status, date) VALUES (?, ?, ?, ?, ?, ?)");
      finance.forEach(f => stmtFin.run([f.patient_id, f.type, f.reference, f.amount, f.status, f.date]));
      stmtFin.finalize();
      console.log(`✓ Seeded ${finance.length} transaction invoices.`);

      // Seed Activities
      const activities = [
        { time: "2026-06-08T09:12:00.000Z", user_id: "usr_1779948492660", action: "Updated record", details: "Patient pat_1", priority: "high", due: "2026-06-09T09:00:00.000Z", status: "open" },
        { time: "2026-06-08T08:58:00.000Z", user_id: "usr_1779963783364", action: "Created shift", details: "Emergency Room Cover", priority: "medium", due: "2026-06-12T18:00:00.000Z", status: "open" }
      ];
      const stmtAct = db.prepare("INSERT INTO activities (time, user_id, action, details, priority, due, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
      activities.forEach(a => stmtAct.run([a.time, a.user_id, a.action, a.details, a.priority, a.due, a.status]));
      stmtAct.finalize();
      console.log(`✓ Seeded ${activities.length} user action trails.`);

      // Seed Analytics
      const analytics = [
        { metric: "Active Users", value: 123, period: "24h" },
        { metric: "Appointments Taken", value: 42, period: "24h" }
      ];
      const stmtAn = db.prepare("INSERT INTO analytics (metric, value, period) VALUES (?, ?, ?)");
      analytics.forEach(a => stmtAn.run([a.metric, a.value, a.period]));
      stmtAn.finalize();
      console.log(`✓ Seeded ${analytics.length} administrative metrics.`);
    });
  });

  db.close((err) => {
    if (err) console.error(err.message);
    console.log('\n🚀 Success! Database migrations applied according to your new schema.');
  });
}