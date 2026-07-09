#!/usr/bin/env node
/**
 * ModuCare — Idempotent database migration + seed.
 *
 * Safe to run on every server start: it only creates schema that does not
 * already exist and inserts reference/demo rows that are not already present.
 * Existing data (e.g. records created through the UI) is preserved.
 *
 * Run directly with `node server/migrate.js` or import { runMigration }.
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

require('dotenv').config();

const { initCapabilities } = require('./config/permissions');

const ROOT = process.cwd();
const dbPath = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite://')
  ? path.resolve(ROOT, process.env.DATABASE_URL.replace('sqlite://', ''))
  : path.join(ROOT, 'src', 'data', 'hospital.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// One consistent password for every seeded account so behaviour is identical
// across clones. Override with SEED_PASSWORD in the environment if desired.
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password1!';
const hash = (pwd) => bcrypt.hashSync(pwd, 12);

function runMigration() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) { console.error('Database connection error:', err.message); return reject(err); }
      db.run('PRAGMA foreign_keys = OFF;', () => buildSchema(db, resolve, reject));
    });
  });
}

function buildSchema(db, resolve, reject) {
  db.serialize(() => {
    console.log('--- Ensuring schema (CREATE TABLE IF NOT EXISTS) ---');

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone_number TEXT,
      passwordHash TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department_id TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id TEXT UNIQUE,
      role_id TEXT,
      department_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone_number TEXT,
      dob TEXT,
      gender TEXT,
      address TEXT,
      county TEXT,
      next_of_kin TEXT,
      next_of_kin_phone TEXT,
      ampkh_id TEXT,
      national_id TEXT,
      insurance_id TEXT,
      hiv_status TEXT DEFAULT 'unknown',
      registration_date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      encounter_date TEXT DEFAULT CURRENT_TIMESTAMP,
      visit_type TEXT,
      provider_id TEXT,
      chief_complaint TEXT,
      vitals TEXT,
      diagnoses TEXT,
      soap_notes TEXT,
      hiv_viral_load TEXT,
      hiv_cd4 TEXT,
      art_regimen TEXT,
      art_adherence TEXT,
      follow_up_plan TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lab_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      encounter_id INTEGER,
      test_type TEXT NOT NULL,
      test_name TEXT,
      status TEXT DEFAULT 'ordered',
      result_value TEXT,
      result_unit TEXT,
      reference_range TEXT,
      abnormal_flag TEXT,
      result_date TEXT,
      ordering_provider_id TEXT,
      notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
      FOREIGN KEY (ordering_provider_id) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operations (
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

    db.run(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT,
      employee_id TEXT,
      action TEXT,
      details TEXT,
      priority TEXT,
      due TEXT,
      status TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pharmacy_dispensing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      encounter_id INTEGER,
      drug_name TEXT NOT NULL,
      drug_code TEXT,
      dosage TEXT,
      frequency TEXT,
      duration_days INTEGER,
      quantity INTEGER,
      regimen_type TEXT,
      adherence_counseled INTEGER DEFAULT 0,
      dispensed_by TEXT,
      dispensed_date TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
      FOREIGN KEY (dispensed_by) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      type TEXT,
      status TEXT,
      employee_id TEXT,
      reminder_due TEXT,
      reminder_sent INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      type TEXT DEFAULT 'shift',
      status TEXT DEFAULT 'scheduled',
      employee_id TEXT,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS finance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      reference TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      date TEXT,
      due TEXT,
      employee_id TEXT,
      patient_id TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      type TEXT DEFAULT 'reminder',
      channel TEXT DEFAULT 'sms',
      subject TEXT,
      body TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      sent_by TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (sent_by) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      doc_type TEXT DEFAULT 'other',
      file_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uploaded_by TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      from_facility TEXT,
      to_facility TEXT NOT NULL,
      reason TEXT,
      request_type TEXT DEFAULT 'referral',
      status TEXT DEFAULT 'pending',
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      requested_by TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      resource_type TEXT,
      resource_id INTEGER,
      status TEXT DEFAULT 'success',
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      current_stock INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 10,
      unit TEXT,
      last_restocked TEXT,
      supplier TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      employee_id TEXT,
      category TEXT,
      patient_id TEXT,
      time TEXT,
      reporter_role TEXT,
      action_taken TEXT,
      witness_name TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS internal_incidents (
      incidents_id INTEGER PRIMARY KEY,
      department_id TEXT,
      FOREIGN KEY (incidents_id) REFERENCES incidents(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS external_incidents (
      incidents_id INTEGER PRIMARY KEY,
      FOREIGN KEY (incidents_id) REFERENCES incidents(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL,
      value REAL,
      period TEXT,
      recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name)',
      'CREATE INDEX IF NOT EXISTS idx_patients_hiv ON patients(hiv_status)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(time)',
      'CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_encounters_date ON encounters(encounter_date)',
      'CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_pharmacy_patient ON pharmacy_dispensing(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_finance_patient ON finance(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_finance_date ON finance(date)',
      'CREATE INDEX IF NOT EXISTS idx_operations_assignee ON operations(employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status)',
      'CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_audit_user ON audit(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)',
      'CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)'
    ];
    indexes.forEach((sql) => db.run(sql));

    console.log('--- Seeding reference + demo data (INSERT OR IGNORE) ---');
    seedData(db);

    initCapabilities()
      .then(() => {
        db.close((err) => {
          if (err) { console.error('Migration close error:', err.message); return reject(err); }
          console.log('✓ Migration complete. Database ready.');
          resolve();
        });
      })
      .catch((e) => {
        console.error('Capability seed error:', e.message);
        db.close(() => reject(e));
      });
  });
}

function seedData(db) {
  const pwdHash = hash(SEED_PASSWORD);

  // 5 role accounts (one per role) + a field worker with no portal login
  db.run(`INSERT OR IGNORE INTO users (id, email, phone_number, passwordHash) VALUES
    ('usr_admin', 'alice@acme.org', '+254700000000', ?),
    ('usr_dan', 'danreech@acme.org', '+254711111111', ?),
    ('usr_lead', 'lead@acme.org', '+254722222222', ?),
    ('usr_supervisor', 'supervisor@acme.org', '+254733333333', ?),
    ('usr_director', 'director@acme.org', '+254744444444', ?)`,
    [pwdHash, pwdHash, pwdHash, pwdHash, pwdHash]);

  db.run(`INSERT OR IGNORE INTO departments (id, name) VALUES
    ('dept_tech', 'IT Engineering'), ('dept_clin', 'Clinical Services'), ('dept_admin', 'Administration')`);

  db.run(`INSERT OR IGNORE INTO roles (id, name, department_id) VALUES
    ('role_dev', 'Front-Desk / Intake', 'dept_tech'),
    ('role_nurse', 'Clinical Staff / Triage', 'dept_clin'),
    ('role_admin', 'System Administrator', 'dept_admin'),
    ('role_lead', 'Healthcare Provider', 'dept_clin'),
    ('role_supervisor', 'M&E Officer', 'dept_admin'),
    ('role_director', 'M&E Director', 'dept_admin'),
    ('role_finance', 'Ancillary Services', 'dept_admin')`);

  db.run(`INSERT OR IGNORE INTO employees (id, name, user_id, role_id, department_id) VALUES
    ('emp_admin', 'Alice Admin', 'usr_admin', 'role_admin', 'dept_admin'),
    ('emp_dan', 'Daniel Mach Reech', 'usr_dan', 'role_dev', 'dept_tech'),
    ('emp_lead', 'Dr. James Lead', 'usr_lead', 'role_lead', 'dept_clin'),
    ('emp_supervisor', 'Jane Supervisor', 'usr_supervisor', 'role_supervisor', 'dept_admin'),
    ('emp_director', 'Dr. Robert Director', 'usr_director', 'role_director', 'dept_admin'),
    ('emp_field_worker', 'John Staff (No Portal Account)', null, 'role_nurse', 'dept_clin')`);

  db.run(`INSERT OR IGNORE INTO patients (id, name, email, phone_number, dob, gender, address, county, next_of_kin, next_of_kin_phone, ampkh_id, national_id, insurance_id, hiv_status) VALUES
    ('pat_1', 'Jane Doe', 'jane@gmail.com', '+254722222222', '1985-03-12', 'Female', 'Eldoret, Kenya', 'Uasin Gishu', 'John Doe', '+254733333333', 'AMP-001', '12345678', 'NHIF-001', 'positive')`);

  db.run(`INSERT OR IGNORE INTO operations (title, description, department, priority, status, assignee, due, tags, notes, employee_id) VALUES
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

  db.run(`INSERT OR IGNORE INTO appointments (time, patient_id, type, status, employee_id) VALUES
    ('2026-06-15T10:00:00Z', 'pat_1', 'Consultation', 'scheduled', 'emp_field_worker')`);

  db.run(`INSERT OR IGNORE INTO finance (type, reference, amount, status, date, due, employee_id, patient_id) VALUES
    ('Invoice', 'INV-2026-001', 4500.00, 'pending', '2026-06-08', '2026-06-22', 'emp_dan', 'pat_1')`);

  db.run(`INSERT OR IGNORE INTO activities (time, employee_id, action, details, priority, due, status) VALUES
    ('2026-06-08T10:15:00Z', 'emp_field_worker', 'Field Assessment', 'Completed physical check', 'medium', null, 'completed')`);

  db.run(`INSERT OR IGNORE INTO incidents (id, created, title, description, status, severity, employee_id) VALUES
    (101, '2026-06-08T09:00:00Z', 'Database Interruption', 'Minor replication gap', 'resolved', 'low', 'emp_dan'),
    (102, '2026-06-08T11:30:00Z', 'External Power Spike', 'Transformer burst outside gate', 'open', 'critical', 'emp_dan')`);

  db.run(`INSERT OR IGNORE INTO internal_incidents (incidents_id, department_id) VALUES (101, 'dept_tech')`);
  db.run(`INSERT OR IGNORE INTO external_incidents (incidents_id) VALUES (102)`);

  db.run(`INSERT OR IGNORE INTO encounters (patient_id, encounter_date, visit_type, provider_id, chief_complaint, vitals, diagnoses, soap_notes, hiv_viral_load, hiv_cd4, art_regimen, art_adherence, follow_up_plan) VALUES
    ('pat_1', '2026-06-15T10:00:00Z', 'Follow-up', 'emp_dan', 'Routine HIV follow-up', '{"bp":"120/80","temp":"36.5","weight":"65","pulse":"72"}', '["HIV/AIDS","Hypertension"]', 'Patient reports good adherence. No side effects.', '< 40', '450', 'TLD', 'Good', 'Return in 3 months for VL repeat')`);

  db.run(`INSERT OR IGNORE INTO lab_orders (patient_id, encounter_id, test_type, test_name, status, result_value, result_unit, reference_range, abnormal_flag, result_date, ordering_provider_id) VALUES
    ('pat_1', 1, 'HIV', 'Viral Load', 'resulted', '< 40', 'copies/mL', '< 50', 'Normal', '2026-06-16T08:00:00Z', 'emp_dan'),
    ('pat_1', 1, 'Hematology', 'CD4 Count', 'resulted', '450', 'cells/uL', '500-1400', 'Normal', '2026-06-16T08:00:00Z', 'emp_dan'),
    ('pat_1', 1, 'Chemistry', 'Creatinine', 'resulted', '1.1', 'mg/dL', '0.6-1.2', 'Normal', '2026-06-16T08:00:00Z', 'emp_dan')`);

  db.run(`INSERT OR IGNORE INTO pharmacy_dispensing (patient_id, encounter_id, drug_name, drug_code, dosage, frequency, duration_days, quantity, regimen_type, adherence_counseled, dispensed_by, notes) VALUES
    ('pat_1', 1, 'Dolutegravir/Lamivudine/Tenofovir', 'TLD', '1 tablet', 'Once daily', 30, 30, 'ART', 1, 'emp_dan', '3-month refill dispensed')`);

  db.run(`INSERT OR IGNORE INTO notifications (patient_id, type, channel, subject, body, sent_by) VALUES
    ('pat_1', 'reminder', 'sms', 'Appointment Reminder', 'You have an appointment on 2026-07-15. Please confirm.', 'emp_admin'),
    ('pat_1', 'result', 'whatsapp', 'Lab Results Ready', 'Your viral load result is < 40 copies/mL. Visit clinic for results.', 'emp_dan')`);

  db.run(`INSERT OR IGNORE INTO documents (patient_id, doc_type, file_name, file_size, uploaded_by) VALUES
    ('pat_1', 'lab_result', 'viral_load_june_2026.pdf', 245000, 'emp_dan'),
    ('pat_1', 'clinical_note', 'encounter_note_june_15.docx', 18500, 'emp_dan')`);

  db.run(`INSERT OR IGNORE INTO referrals (patient_id, from_facility, to_facility, reason, request_type, status, requested_by) VALUES
    ('pat_1', 'AMPATH Uzima Clinic', 'Moi Teaching and Referral Hospital', 'Complex TB/HIV co-infection case', 'referral', 'pending', 'emp_dan')`);

  db.run(`INSERT OR IGNORE INTO inventory (name, category, current_stock, reorder_level, unit, supplier) VALUES
    ('Dolutegravir/Lamivudine/Tenofovir (TLD)', 'medication', 500, 100, 'tablets', 'KAZ'),
    ('Cotrimoxazole 960mg', 'medication', 200, 50, 'tablets', 'KAZ'),
    ('Rapid HIV Test Kits', 'consumable', 50, 20, 'kits', 'Egypt'),
    ('Blood Pressure Cuffs', 'equipment', 15, 5, 'units', 'Local Supplier'),
    ('Glucose Test Strips', 'consumable', 30, 15, 'strips', 'KAZ')`);

  db.run(`INSERT OR IGNORE INTO audit (user_id, action, details, resource_type, status) VALUES
    ('usr_dan', 'login', 'User logged in successfully', 'auth', 'success'),
    ('usr_admin', 'create_encounter', 'Created encounter for pat_1', 'encounter', 'success'),
    ('usr_dan', 'dispense', 'Dispensed TLD to pat_1', 'pharmacy', 'success'),
    ('usr_admin', 'view_patient', 'Viewed patient record pat_1', 'patient', 'success')`);
}

if (require.main === module) {
  runMigration()
    .then(() => { console.log('\n🚀 Success! Database migration applied clean and successfully!'); process.exit(0); })
    .catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
}

module.exports = { runMigration };
