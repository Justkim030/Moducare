// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Patients from './pages/Patients';
import Staff from './pages/Staff';
import Prescriptions from './pages/Prescriptions';
import Dispense from './pages/Dispense';
import NotFound from './pages/NotFound';
import ProtectedRoute from './routes/ProtectedRoute';
import Layout from './components/layout/Layout';
import PatientRegistration from './pages/PatientRegistration';
import TriageQueue from './pages/TriageQueue';
import TriageForm from './pages/TriageForm';
import EditProfile from './pages/EditProfile';
import Settings from './pages/Settings';
import ConsultationReport from './pages/ConsultationReport';
import ReportList from './pages/ReportList';
import Accounts from './pages/Accounts';
import Laboratory from './pages/Laboratory';
import WardDashboard from './pages/WardDashboard';
import Incidents from './pages/Incidents';
import HR from './pages/HR';
import Appointments from './pages/Appointments';
import Finance from './pages/Finance';
import Audit from './pages/Audit';
import Notifications from './pages/Notifications';
import Referrals from './pages/Referrals';
import Operations from './pages/Operations';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Documents from './pages/Documents';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/dispense" element={<Dispense />} />
          <Route path="/register" element={<PatientRegistration />} />
          <Route path="/triage-queue" element={<TriageQueue />} />
          <Route path="/triage-assessment/:patientId" element={<TriageForm />} />
          <Route path="/profile" element={<EditProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/report/:visitId" element={<ConsultationReport />} />
          <Route path="/reports" element={<ReportList />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/lab" element={<Laboratory />} />
          <Route path="/ward" element={<WardDashboard />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/hr" element={<HR />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/documents" element={<Documents />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;