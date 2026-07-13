// src/pages/Prescriptions.jsx
import React, { useState, useEffect } from 'react';
import { prescriptionService } from '../api/prescriptionService';
import { visitService } from '../api/visitService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Modal from '../components/common/Modal'; 
import Button from '../components/common/Button'; // Unified Button Component
import './Prescriptions.css';
import '../App.css';

function Prescriptions() {
  const [myPrescriptions, setMyPrescriptions] = useState([]);
  const [loadingForm, setLoadingForm] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 

  const [currentVisit, setCurrentVisit] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySortOrder, setHistorySortOrder] = useState('-date_prescribed');

  useEffect(() => {
    const loadFormData = async () => {
      setError(null);
      const visitIdFromUrl = searchParams.get('visit_id');

      if (!visitIdFromUrl) {
        setLoadingForm(false);
        return; 
      }

      try {
        setLoadingForm(true);
        const visitRes = await visitService.getVisitById(visitIdFromUrl);
        setCurrentVisit(visitRes.data);
      } catch (err) {
        setError('Failed to extract case routing attributes.');
      } finally {
        setLoadingForm(false);
      }
    };
    loadFormData();
  }, [searchParams]);

  useEffect(() => {
    fetchPrescriptionHistory();
  }, [historyCurrentPage, historyPageSize, historySortOrder]);

  const fetchPrescriptionHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await prescriptionService.getMyPrescriptions(historyCurrentPage, historyPageSize, historySortOrder);
      setMyPrescriptions(res.data.results || []);
      setHistoryTotal(res.data.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleHistoryPrevPage = () => {
    setHistoryCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleHistoryNextPage = () => {
    setHistoryCurrentPage(prev => prev + 1);
  };

  const totalHistoryPages = Math.ceil(historyTotal / historyPageSize);

  return (
    <div className="prescriptions-page">
      <h2>Prescriptions Registry Console</h2>
      {error && <p className="page-error">{error}</p>}

      <div className="prescriptions-layout-grid">
        {/* LEFT WORKSPACE PANEL: Form Processing */}
        <div className="workspace-panel">
          <h3>Active Prescription Case Formulation</h3>
          
          {loadingForm ? (
            /* Form Shimmer Loader */
            <div className="skeleton-form-container">
              <div className="skeleton-element form-title"></div>
              <div className="skeleton-element form-box large"></div>
              <div className="skeleton-element form-btn"></div>
            </div>
          ) : currentVisit ? (
            <div className="case-formulation-active">
              <div className="active-case-banner">
                <h4>Patient: {currentVisit.patient_name}</h4>
                <p>Visit ID: <strong>#{currentVisit.id}</strong> &bull; Age Status: <strong>{currentVisit.patient_age || 'N/A'}</strong></p>
              </div>
              
              {/* Prescription Form Elements would build right here */}
              <div style={{ marginTop: '1.5rem' }}>
                <Button onClick={() => setIsReviewOpen(true)} variant="submit" style={{ width: '100%' }}>
                  Review Case Specifications & Proceed
                </Button>
              </div>
            </div>
          ) : (
            <div className="empty-panel-state">
              <p>No active diagnostic visit session is loaded in the workspace.</p>
              <Button onClick={() => navigate('/registration')} variant="edit">
                Route to Registration Index
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT WORKSPACE PANEL: Historical Audit Log */}
        <div className="workspace-panel">
          <div className="panel-header-controls">
            <h3>Prescription Fulfillment Log</h3>
            
            {!loadingHistory && totalHistoryPages > 1 && (
              <div className="pagination-compact">
                <span className="compact-page-info">
                  Page {historyCurrentPage} of {totalHistoryPages}
                </span>
                <div className="compact-buttons">
                  <Button onClick={handleHistoryPrevPage} disabled={historyCurrentPage === 1} variant="edit" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                    &larr; Prev
                  </Button>
                  <Button onClick={handleHistoryNextPage} disabled={historyCurrentPage === totalHistoryPages || historyTotal === 0} variant="edit" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                    Next &rarr;
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="table-responsive-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient Target</th>
                  <th>Date Issued</th>
                  <th>Status State</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  /* History List Table Rows Shimmer Loop */
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-row-${index}`} className="skeleton-row">
                      <td><div className="skeleton-element row-text" style={{ width: '35px' }}></div></td>
                      <td><div className="skeleton-element row-text" style={{ width: '130px' }}></div></td>
                      <td><div className="skeleton-element row-text" style={{ width: '75px' }}></div></td>
                      <td><div className="skeleton-element row-badge" style={{ width: '65px' }}></div></td>
                    </tr>
                  ))
                ) : myPrescriptions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center-muted">No historic prescription records localized.</td>
                  </tr>
                ) : (
                  myPrescriptions.map(p => (
                    <tr key={p.id}>
                      <td><strong>#{p.id}</strong></td>
                      <td>{p.patient_name}</td>
                      <td>{new Date(p.date_prescribed).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge status-${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dynamic Overlay Case Review Review Modal */}
      {isReviewOpen && currentVisit && (
        <Modal onClose={() => setIsReviewOpen(false)}>
          <div className="review-overlay-content">
            <h3>Finalize Clinical Case Matrix</h3>
            <p>Ensure medical validation attributes match for <strong>{currentVisit.patient_name}</strong> prior to executing pharmacy database locks.</p>
            <div className="modal-actions-wrapper">
              <Button onClick={() => setIsReviewOpen(false)} variant="submit">Authorize Release</Button>
              <Button onClick={() => setIsReviewOpen(false)} variant="edit">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Prescriptions;