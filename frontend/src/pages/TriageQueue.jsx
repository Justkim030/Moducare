// src/pages/TriageQueue.jsx
import React, { useState, useEffect } from 'react';
import { visitService } from '../api/visitService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/common/Modal'; 
import './Triage.css'; 
import '../App.css';

function TriageQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  const { user } = useAuth();
  const isDoctor = user?.user?.employee_type === 'DOCTOR' || user?.employee_type === 'DOCTOR';

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalVisits, setTotalVisits] = useState(0);
  
  const defaultSortOrder = '-visit_date'; 

  const fetchQueue = async () => {
    try {
      setLoading(true);
      // Ensure you match "PENDING" with backend expectation
      const res = await visitService.getVisits(currentPage, pageSize, defaultSortOrder, 'PENDING'); 
      setQueue(res.data.results || []);
      setTotalVisits(res.data.count || 0);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load patient queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    
    const interval = setInterval(() => {
      fetchQueue();
    }, 30000); 
    
    return () => clearInterval(interval);
  }, [currentPage, pageSize]); 
  
  // ... (handleConsult, handleWriteReport, handleViewDetails, helpers remain same) ...
  const handleConsult = (visit) => {
    if (!isDoctor) return;
    navigate(`/prescriptions?visit_id=${visit.id}`); 
  };

  const handleWriteReport = (visit) => {
    if (!isDoctor) return;
    navigate(`/report/${visit.id}`);
  };

  const handleViewDetails = (visit) => {
    setSelectedVisit(visit);
  };

  const formatTriageLevel = (level) => {
    if (!level) return 'N/A';
    return level.replace('LEVEL_', 'Level ');
  };

  const getPatientName = (visit) => {
    if (visit.patient_name) return visit.patient_name;
    if (visit.patient && visit.patient.name) {
      return `${visit.patient.name.first_name} ${visit.patient.name.second_name}`;
    }
    return 'Unknown Patient';
  };

  const totalPages = Math.ceil(totalVisits / pageSize);
  const handlePageSizeChange = (e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); };
  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  return (
    <div className="triage-page-container">
      <div className="triage-queue-container">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
            <div>
                <h2>Today's Consultation Queue</h2>
                <p className="triage-queue-subtitle">Queue prioritized by time (Pending Patients)</p>
            </div>
            <button onClick={fetchQueue} className="submit-btn" style={{padding: '8px 15px'}}>
                ↻ Refresh
            </button>
        </div>
        
        {error && <p className="page-error">{error}</p>}

        <div className="triage-list-container">
          {/* Pagination Controls */}
          <div className="pagination-controls">
            <div className="form-group">
              <label htmlFor="pageSize">Show:</label>
              <select id="pageSize" value={pageSize} onChange={handlePageSizeChange}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span className="page-info">
              {totalPages > 1 ? `Page ${currentPage} of ${totalPages} | ` : ''}
              {totalVisits} total patients
            </span>
            <div className="pagination-buttons">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="pagination-btn">&larr; Previous</button>
              <button onClick={handleNextPage} disabled={currentPage === totalPages || totalVisits === 0} className="pagination-btn">Next &rarr;</button>
            </div>
          </div>

          <table className="triage-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Patient Name</th>
                <th>Waiting Since</th>
                {isDoctor && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={isDoctor ? 4 : 3}>Loading queue...</td></tr>}
              {!loading && queue.length === 0 && (
                <tr><td colSpan={isDoctor ? 4 : 3}>The queue is currently empty.</td></tr>
              )}
              {queue.map(visit => {
                const level = visit.triage?.triage_level; 
                
                return (
                  <tr key={visit.id} className={`triage-level-${level}`}>
                    <td>{formatTriageLevel(level)}</td>
                    
                    <td 
                      className="patient-name-cell" 
                      onClick={() => handleViewDetails(visit)}
                      title="Click to view full details"
                    >
                      {getPatientName(visit)}
                    </td>

                    <td>
                      {new Date(visit.visit_date).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit', hour12: true
                      })}
                    </td>
                    
                    {isDoctor && (
                      <td className="action-buttons-cell">
                          <button onClick={() => handleConsult(visit)} className="triage-btn-small consult">
                              Prescribe
                          </button>
                          <button onClick={() => handleWriteReport(visit)} className="triage-btn-small report">
                              Report
                          </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ... (Patient Details Modal remains the same) ... */}
      {selectedVisit && (
        <Modal 
          onClose={() => setSelectedVisit(null)} 
          title={`Details for ${getPatientName(selectedVisit)}`}
        >
          <div className="visit-details-modal">
            <div className="detail-group">
              <label>Chief Complaint:</label>
              {/* UPDATE 4: Access nested triage data for Modal */}
              <p>{selectedVisit.triage?.chief_complaint || "Not recorded"}</p>
            </div>
            
            <div className="detail-group">
              <label>Priority Level:</label>
              <p>{formatTriageLevel(selectedVisit.triage?.triage_level)}</p>
            </div>

            <div className="vitals-grid-display">
               <div className="vital-item">
                 <label>Blood Pressure:</label>
                 <span>
                   {selectedVisit.triage?.bp_systolic || '--'} / 
                   {selectedVisit.triage?.bp_diastolic || '--'} mmHg
                 </span>
               </div>
               <div className="vital-item">
                 <label>Heart Rate:</label>
                 <span>{selectedVisit.triage?.heart_rate || '--'} bpm</span>
               </div>
               <div className="vital-item">
                 <label>Body Temp:</label>
                 <span>{selectedVisit.triage?.body_temp || '--'} °C</span>
               </div>
               <div className="vital-item">
                 <label>Weight:</label>
                 <span>{selectedVisit.triage?.weight || '--'} kg</span>
               </div>
            </div>
            
            <div className="modal-actions" style={{marginTop: '20px', textAlign: 'right'}}>
               {isDoctor && (
                 <button 
                    onClick={() => {
                      handleConsult(selectedVisit);
                      setSelectedVisit(null);
                    }}
                    className="submit-btn"
                 >
                    Start Consultation
                 </button>
               )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TriageQueue;