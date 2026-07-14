// src/pages/Incidents.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { incidentService } from '../api/incidentService'; //[cite: 4]
import './Incidents.css';
import '../App.css';

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
useEffect(() => {
    let isMounted = true;

    async function fetchIncidents() {
      try {
        setLoading(true);
        setError(null);
        // Clean API call to the incident service
        const response = await incidentService.getIncidentReports();
        
        let extractedData = [];
        const resData = response?.data;

        // Defensive parsing to ensure we ALWAYS extract a valid array
        if (resData) {
          if (Array.isArray(resData)) {
            // 1. If it's a flat list: [{}, {}]
            extractedData = resData;
          } else if (Array.isArray(resData.results)) {
            // 2. If it's a paginated DRF list: { results: [{}, {}] }
            extractedData = resData.results;
          } else if (Array.isArray(resData.pending)) {
            // 3. If it's your custom pending list: { pending: [{}, {}] }
            extractedData = resData.pending;
          } else {
            // 4. Emergency fallback: Find the first array property inside the object
            const firstFoundArray = Object.values(resData).find(val => Array.isArray(val));
            if (firstFoundArray) {
              extractedData = firstFoundArray;
            }
          }
        }
        
        if (isMounted) {
          setIncidents(extractedData);
        }
      } catch (err) {
        console.error('Error fetching incident logs:', err);
        if (isMounted) {
          setError('Failed to load incident registry. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchIncidents();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Incident Registry...</p>
      </div>
    );
  }

  return (
    <div className="incidents-page">
      <header className="incidents-header">
        <h2>Incident Registry</h2>
        <Link to="/" className="back-btn">
          &larr; Back to Dashboard
        </Link>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="wide-card">
        <div className="card-header">
          <h3>Registered System Anomalies &amp; Medical Failures</h3>
          <p className="subtext">
            Official ledger of hospital operational complaints, safety events, and system down-times.
          </p>
        </div>

        {incidents.length === 0 ? (
          <div className="empty-state">
            <p>No registered incidents found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="incidents-table">
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Title / Description</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => {
                  const severityClass = incident.severity?.toLowerCase() || 'medium';
                  const statusClass = incident.status?.toLowerCase() === 'pending' ? 'status-pending' : 'status-resolved';
                  
                  return (
                    <tr key={incident.id}>
                      <td className="col-id">#{incident.id}</td>
                      <td className="col-title">{incident.title || 'System Anomaly / Equipment Issue'}</td>
                      <td className="col-severity">
                        <span className={`severity-badge ${severityClass}`}>
                          {incident.severity || 'Medium'}
                        </span>
                      </td>
                      <td className="col-status">
                        <span className={`status-dot ${statusClass}`}>
                          {incident.status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default Incidents;