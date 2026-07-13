// src/pages/WardDashboard.jsx
import React, { useState, useEffect } from 'react';
import { wardService } from '../api/wardService';
import { visitService } from '../api/visitService';
import Modal from '../components/common/Modal';
import './WardDashboard.css';
import '../App.css';

function WardDashboard() {
  // 1. Define all state variables at the top
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // 2. Define logData correctly (Ensure this is exactly as written)
  const [logData, setLogData] = useState({
    body_temp: '', 
    bp_systolic: '', 
    bp_diastolic: '', 
    heart_rate: '', 
    notes: ''
  });
  
  const [patientLogs, setPatientLogs] = useState([]);

  useEffect(() => {
    fetchAdmittedPatients();
  }, []);

  const fetchAdmittedPatients = async () => {
    try {
      setLoading(true);
      // Fetch all visits
      const res = await visitService.getVisits(1, 100, '-visit_date', ''); 
      const allVisits = res.data.results || res.data || [];
      
      // Filter for In-Patients (IPD) who are NOT discharged
      const admitted = allVisits.filter(v => 
        v.patient_type === 'IPD' && 
        v.status !== 'DISCHARGED' && 
        v.status !== 'COMPLETED'
      );
      
      setPatients(admitted);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load ward list.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLogModal = (visit) => {
    setSelectedVisit(visit);
    // Reset form data
    setLogData({ 
      body_temp: '', 
      bp_systolic: '', 
      bp_diastolic: '', 
      heart_rate: '', 
      notes: '' 
    });
    setIsLogModalOpen(true);
  };

  const handleOpenHistory = async (visit) => {
    setSelectedVisit(visit);
    setIsHistoryModalOpen(true);
    try {
      const res = await wardService.getWardLogs(visit.id);
      setPatientLogs(res.data.results || res.data);
    } catch (err) {
        console.error(err);
        alert('Failed to fetch history.');
    }
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    try {
      // Construct payload matching the Serializer
      const payload = {
        visit: selectedVisit.id,
        notes: logData.notes,
        triage: {
            body_temp: logData.body_temp,
            bp_systolic: logData.bp_systolic,
            bp_diastolic: logData.bp_diastolic,
            heart_rate: logData.heart_rate,
            triage_level: null, 
            chief_complaint: null
        }
      };

      await wardService.addWardLog(payload);
      alert('Rounds logged successfully.');
      setIsLogModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save log.');
    }
  };

  const handleDischarge = async (visit) => {
    if (!window.confirm(`Discharge ${visit.patient_name}? This will free up Bed ${visit.bed_number}.`)) return;
    try {
      await wardService.dischargePatient(visit.id);
      fetchAdmittedPatients(); 
    } catch (err) {
      console.error(err);
      alert('Discharge failed.');
    }
  };

  return (
    <div className="ward-page">
      <div className="ward-header">
        <h2>In-Patient Ward Dashboard</h2>
      </div>

      {error && <p className="page-error">{error}</p>}

      <div className="ward-list-container">
        <table className="ward-table">
          <thead>
            <tr>
              <th>Ward / Bed</th>
              <th>Patient</th>
              <th>Admission Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="skeleton-row">
                  <td><div className="skeleton-block skeleton-text" style={{ width: '70px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '140px' }}></div></td>
                  <td><div className="skeleton-block skeleton-badge" style={{ width: '90px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '100px' }}></div></td>
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center">No patients currently admitted.</td>
              </tr>
            ) : (
              patients.map(visit => (
                <tr key={visit.id}>
                  <td>
                    <div className="bed-badge">
                      {visit.ward || 'Gen'} - {visit.bed_number || 'Unassigned'}
                    </div>
                  </td>
                  <td><strong>{visit.patient_name}</strong></td>
                  <td>{new Date(visit.visit_date).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleOpenLogModal(visit)} className="log-btn">Add Vitals</button>
                      <button onClick={() => handleOpenHistory(visit)} className="history-btn">View Logs</button>
                      <button onClick={() => handleDischarge(visit)} className="discharge-btn">Discharge</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- LOG ROUNDS MODAL --- */}
      {isLogModalOpen && selectedVisit && (
        <Modal onClose={() => setIsLogModalOpen(false)} title={`Nursing Rounds: ${selectedVisit.patient_name}`}>
          <form onSubmit={handleSubmitLog} className="ward-form">
            <div className="vitals-grid">
                <div className="form-group">
                    <label>Temp (°C)</label>
                    <input type="number" step="0.1" value={logData.body_temp} onChange={e => setLogData({...logData, body_temp: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>HR (bpm)</label>
                    <input type="number" value={logData.heart_rate} onChange={e => setLogData({...logData, heart_rate: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>BP Systolic</label>
                    <input type="number" value={logData.bp_systolic} onChange={e => setLogData({...logData, bp_systolic: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>BP Diastolic</label>
                    <input type="number" value={logData.bp_diastolic} onChange={e => setLogData({...logData, bp_diastolic: e.target.value})} />
                </div>
            </div>
            <div className="form-group">
                <label>Observation Notes</label>
                <textarea value={logData.notes} onChange={e => setLogData({...logData, notes: e.target.value})} required placeholder="Patient condition, medication given, etc." />
            </div>
            <button type="submit" className="submit-btn">Save Log</button>
          </form>
        </Modal>
      )}

      {/* --- HISTORY MODAL --- */}
      {isHistoryModalOpen && selectedVisit && (
        <Modal onClose={() => setIsHistoryModalOpen(false)} title={`History: ${selectedVisit.patient_name}`}>
          <div className="log-history-list">
            {patientLogs.length === 0 ? <p>No logs recorded yet.</p> : 
                patientLogs.map(log => (
                    <div key={log.id} className="log-card">
                        <div className="log-header">
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                            <span className="nurse-name">By: {log.nurse_name}</span>
                        </div>
                        <div className="log-vitals">
                            {/* Access nested triage data safely */}
                            <span>Temp: {log.triage?.body_temp || '-'}°C</span> | 
                            <span> BP: {log.triage?.bp_systolic || '-'}/{log.triage?.bp_diastolic || '-'}</span> | 
                            <span> HR: {log.triage?.heart_rate || '-'}</span>
                        </div>
                        <p className="log-note">{log.notes}</p>
                    </div>
                ))
            }
          </div>
        </Modal>
      )}
    </div>
  );
}

export default WardDashboard;