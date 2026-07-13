// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { patientService } from '../api/patientService';
import { userService } from '../api/userService';
import { inventoryService } from '../api/inventoryService';
import { prescriptionService } from '../api/prescriptionService';
import { visitService } from '../api/visitService';
import { wardService } from '../api/wardService';
import { labService } from '../api/labService';
import { accountService } from '../api/accountService';
import { useAuth } from '../hooks/useAuth'; 
import { Link } from 'react-router-dom';
import './Dashboard.css';
import '../App.css';

// Reusable Skeleton Component for Dashboard Statistic Cards
const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-line short"></div>
    <div className="skeleton-circle-or-num"></div>
  </div>
);

// Reusable Skeleton Component for Dashboard Sidebar Lists
const SkeletonList = ({ rows = 3 }) => (
  <div className="skeleton-list-wrapper">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="skeleton-list-item">
        <div className="skeleton-line long"></div>
        <div className="skeleton-line short"></div>
      </div>
    ))}
  </div>
);

// 1. NURSE DASHBOARD
const NurseDashboard = ({ stats, loading }) => (
  <div className="dashboard-lists">
    <div className="dashboard-list-card wide-card">
      <h3>Ward Overview</h3>
      <p className="text-gray-600 mb-4">Monitor admitted patients and nursing rounds operations.</p>
      <div className="stat-card-container">
        {loading ? (
          <SkeletonCard />
        ) : (
          <div className="stat-card" style={{ minWidth: 'auto' }}>
            <h3>Admitted Patients</h3>
            <p className="stat-number">{stats.admittedPatients}</p>
          </div>
        )}
      </div>
      <div style={{ marginTop: '20px' }}>
        <Link to="/ward" className="submit-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Go to Ward Dashboard &rarr;
        </Link>
      </div>
    </div>
    
    <div className="dashboard-list-card sidebar-card">
      <h3>Quick Tools & Actions</h3>
      <ul className="dashboard-list">
        <li><Link to="/patients">Patient Directory / Triage</Link></li>
        <li><Link to="/ward">Bed Allocation & Tracking</Link></li>
      </ul>
    </div>
  </div>
);

// 2. DOCTOR DASHBOARD
const DoctorDashboard = ({ recentPatients, loading }) => (
  <div className="dashboard-lists">
    <div className="dashboard-list-card wide-card">
      <h3>Patient Consultation Queue</h3>
      <p className="text-gray-600 mb-4">Select an active patient registration below to check vital signs or write clinical notes.</p>
      <div style={{ marginTop: '15px' }}>
        <Link to="/patients" className="submit-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Open Medical Consultation Desk &rarr;
        </Link>
      </div>
    </div>
    
    <div className="dashboard-list-card sidebar-card">
      <h3>My Recent Consultations</h3>
      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <ul className="dashboard-list">
          {recentPatients.slice(0, 3).map(p => (
            <li key={p.id}>
              <span>{p.first_name} {p.second_name}</span>
              <span className="list-meta">ID: #{p.id}</span>
            </li>
          ))}
          {recentPatients.length === 0 && <li className="text-gray-500">No recent entries logged.</li>}
        </ul>
      )}
    </div>
  </div>
);

// 3. PHARMACIST DASHBOARD
const PharmacistDashboard = ({ lowStockMeds, loading }) => (
  <div className="dashboard-lists">
    <div className="dashboard-list-card wide-card">
      <h3>Prescription Fulfillment</h3>
      <p className="text-gray-600 mb-4">Review medical sheets, calculate pricing, and record drug dispensing workflows.</p>
      <div style={{ marginTop: '15px' }}>
        <Link to="/dispense" className="submit-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Open Dispensing Console &rarr;
        </Link>
      </div>
    </div>
    
    <div className="dashboard-list-card sidebar-card urgent-card-alert">
      <h3>Critical Stock Warnings</h3>
      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <ul className="dashboard-list">
          {lowStockMeds.slice(0, 4).map(m => (
            <li key={m.id}>
              <span><strong>{m.name}</strong></span>
              <span className="list-meta low-stock">{m.quantity} units left</span>
            </li>
          ))}
          {lowStockMeds.length === 0 && <li className="text-gray-500">All inventory batches healthy.</li>}
        </ul>
      )}
    </div>
  </div>
);

// 4. LAB TECH DASHBOARD
const LabTechDashboard = () => (
  <div className="dashboard-lists">
    <div className="dashboard-list-card wide-card">
      <h3>Diagnostics & Investigation Queue</h3>
      <p className="text-gray-600 mb-4">Update specimen sample tracking profiles, configure assay parameters, and report diagnostic answers.</p>
      <div style={{ marginTop: '15px' }}>
        <Link to="/lab" className="submit-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Launch Laboratory Workbench &rarr;
        </Link>
      </div>
    </div>
    <div className="dashboard-list-card sidebar-card">
      <h3>Lab Operations</h3>
      <ul className="dashboard-list">
        <li><Link to="/lab">Pending Work Orders</Link></li>
        <li><Link to="/lab">Test Catalog Settings</Link></li>
      </ul>
    </div>
  </div>
);

// 5. ACCOUNTANT DASHBOARD
const AccountantDashboard = ({ invoiceStats, loading }) => (
  <div className="dashboard-lists">
    <div className="dashboard-list-card wide-card">
      <h3>Billing Ledger Summary</h3>
      <div className="stat-card-container">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <div className="stat-card">
              <h3>Pending Invoices</h3>
              <p className="stat-number">{invoiceStats.pendingCount}</p>
            </div>
            <div className="stat-card">
              <h3>Total Receivables</h3>
              <p className="stat-number">${Number(invoiceStats.totalPendingAmount).toFixed(2)}</p>
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: '25px' }}>
        <Link to="/accounts" className="submit-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Open Cashier Desk &rarr;
        </Link>
      </div>
    </div>
    
    <div className="dashboard-list-card sidebar-card">
      <h3>Financial Access Links</h3>
      <ul className="dashboard-list">
        <li><Link to="/accounts">Patient Invoices</Link></li>
        <li><Link to="/accounts">Process Reimbursements</Link></li>
      </ul>
    </div>
  </div>
);

// 6. ADMIN DASHBOARD
const AdminDashboard = ({ stats, recentPatients, lowStockMeds, loading }) => (
  <div className="admin-grid-dashboard">
    <div className="stat-card-container">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
      ) : (
        <>
          <div className="stat-card">
            <h3>Total Registered Patients</h3>
            <p className="stat-number">{stats.totalPatients}</p>
          </div>
          <div className="stat-card">
            <h3>Active Workforce Staff</h3>
            <p className="stat-number">{stats.totalEmployees}</p>
          </div>
          <div className="stat-card">
            <h3>Active Clinical Visits</h3>
            <p className="stat-number">{stats.activeVisits}</p>
          </div>
          <div className="stat-card">
            <h3>Inventory Varieties</h3>
            <p className="stat-number">{stats.totalMedicines}</p>
          </div>
        </>
      )}
    </div>

    <div className="dashboard-lists">
      <div className="dashboard-list-card">
        <h3>Recent Patient Admissions</h3>
        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <ul className="dashboard-list">
            {recentPatients.slice(0, 4).map(p => (
              <li key={p.id}>
                <span><strong>{p.first_name} {p.second_name}</strong></span>
                <span className="list-meta">Registered: {new Date(p.register_date).toLocaleDateString()}</span>
              </li>
            ))}
            {recentPatients.length === 0 && <li className="text-gray-500">No patient logs registered.</li>}
          </ul>
        )}
      </div>

      <div className={`dashboard-list-card ${lowStockMeds.length > 0 ? 'low-stock-card' : ''}`}>
        <h3>Stock Alert: Low Inventory</h3>
        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <ul className="dashboard-list">
            {lowStockMeds.slice(0, 4).map(m => (
              <li key={m.id}>
                <span>{m.name}</span>
                <span className="list-meta low-stock">{m.quantity} left</span>
              </li>
            ))}
            {lowStockMeds.length === 0 && <li className="text-gray-500">All medicines well-stocked.</li>}
          </ul>
        )}
      </div>
    </div>
  </div>
);

function Dashboard() {
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [adminStats, setAdminStats] = useState({ totalPatients: 0, totalEmployees: 0, activeVisits: 0, totalMedicines: 0 });
  const [nurseStats, setNurseStats] = useState({ admittedPatients: 0 });
  const [accountantStats, setAccountantStats] = useState({ pendingCount: 0, totalPendingAmount: 0 });
  const [recentPatients, setRecentPatients] = useState([]);
  const [lowStockMeds, setLowStockMeds] = useState([]);

  const role = user?.user?.employee_type || '';

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        setError(null);

        if (role === 'ADMIN') {
          const [pRes, empRes, visitRes, medRes] = await Promise.all([
            patientService.getAllPatients(1, 5),
            userService.getAllEmployees(1, 1),
            visitService.getVisits('ACTIVE'),
            inventoryService.getAllMedicines(1, 100)
          ]);

          const allMeds = medRes.data.results || [];
          const criticallyLow = allMeds.filter(m => m.quantity <= 10);

          setAdminStats({
            totalPatients: pRes.data.count || 0,
            totalEmployees: empRes.data.count || 0,
            activeVisits: visitRes.data.count || (visitRes.data.results?.length) || 0,
            totalMedicines: pRes.data.count || allMeds.length
          });
          setRecentPatients(pRes.data.results || []);
          setLowStockMeds(criticallyLow);

        } else if (role === 'DOCTOR') {
          const pRes = await patientService.getAllPatients(1, 5);
          setRecentPatients(pRes.data.results || []);

        } else if (role === 'PHARMACIST') {
          const medRes = await inventoryService.getAllMedicines(1, 100);
          const allMeds = medRes.data.results || [];
          setLowStockMeds(allMeds.filter(m => m.quantity <= 10));

        } else if (role === 'NURSE') {
          const wardRes = await wardService.getAdmissions();
          setNurseStats({ admittedPatients: wardRes.data.count || wardRes.data.length || 0 });

        } else if (role === 'ACCOUNTANT') {
          const invRes = await accountService.getAllInvoices(1, 100, '', 'PENDING');
          const pInvoices = invRes.data.results || [];
          const sumPending = pInvoices.reduce((acc, curr) => acc + Number(curr.balance), 0);
          setAccountantStats({
            pendingCount: invRes.data.count || pInvoices.length,
            totalPendingAmount: sumPending
          });
        }
      } catch {
        setError('Error synchronizing active telemetry widgets.');
      } finally {
        setLoading(false);
      }
    }

    if (role) loadDashboardData();
  }, [role]);

  const renderDashboardContent = () => {
    switch (role) {
      case 'NURSE':      return <NurseDashboard stats={nurseStats} loading={loading} />;
      case 'DOCTOR':     return <DoctorDashboard recentPatients={recentPatients} loading={loading} />;
      case 'PHARMACIST': return <PharmacistDashboard lowStockMeds={lowStockMeds} loading={loading} />;
      case 'LAB_TECH':   return <LabTechDashboard />;
      case 'ACCOUNTANT': return <AccountantDashboard invoiceStats={accountantStats} loading={loading} />;
      case 'ADMIN':      return <AdminDashboard stats={adminStats} recentPatients={recentPatients} lowStockMeds={lowStockMeds} loading={loading} />;
      default:           return <h2>Welcome, {user?.user?.username || 'User'}! Please utilize the side navigation ledger.</h2>;
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-clean-header">
        <h2>{role ? `${role.replace('_', ' ')} Dashboard` : 'Control Panel'}</h2>
        <div className="header-date-badge">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
      </div>
      {error && <p className="page-error">{error}</p>}
      <div className="dashboard-viewport-main">
        {renderDashboardContent()}
      </div>
    </div>
  );
}

export default Dashboard;