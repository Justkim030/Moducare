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
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;