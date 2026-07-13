// src/pages/ReportList.jsx
import React, { useState, useEffect } from 'react';
import { visitService } from '../api/visitService';
import Button from '../components/common/Button'; // Integrated standard Button component
import './ReportList.css'; 
import '../App.css';

function ReportList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await visitService.getVisits('COMPLETE');
      
      const visitsWithReports = (res.data.results || res.data).filter(
        visit => visit.consultation_notes
      );

      visitsWithReports.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      
      setReports(visitsWithReports);
      setError(null);
    } catch (err) {
      setError('Failed to fetch consultation reports.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="report-list-page">
      {/* Symmetrical Header Row eliminating awkward gaps */}
      <div className="report-header-row">
        <h2>Consultation Reports Registry</h2>
        <Button onClick={fetchReports} variant="edit">
          ↻ Refresh Index
        </Button>
      </div>
      
      {error && <p className="page-error">{error}</p>}

      <div className="report-list-container">
        {loading ? (
          /* Shimmering Skeleton Review State Layout Blocks */
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`skeleton-report-${index}`} className="skeleton-report-card">
              <div className="skeleton-header">
                <div className="skeleton-bar title-shimmer"></div>
                <div className="skeleton-bar date-shimmer"></div>
              </div>
              <div className="skeleton-body">
                <div className="skeleton-bar text-shimmer line-1"></div>
                <div className="skeleton-bar text-shimmer line-2"></div>
                <div className="skeleton-bar text-shimmer block-3"></div>
              </div>
            </div>
          ))
        ) : reports.length === 0 ? (
          <p className="text-center-muted">No consultation reports have been indexed yet.</p>
        ) : (
          reports.map(report => (
            <div key={report.id} className="report-card">
              <div className="report-card-header">
                <h3>{report.patient_name}</h3>
                <span className="report-date-tag">
                  {new Date(report.visit_date).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </span>
              </div>
              <div className="report-card-body">
                <p><strong>Chief Complaint:</strong> {report.chief_complaint || 'No recorded complaint.'}</p>
                <div className="notes-container-block">
                  <strong>Clinical Documentation Summary:</strong>
                  <pre className="report-notes-content">
                    {report.consultation_notes}
                  </pre>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ReportList;