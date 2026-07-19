// src/pages/Audit.jsx
import React, { useState, useEffect } from 'react';
import { auditService } from '../api/auditService';
import './Audit.css';

function Audit() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await auditService.getAuditLogs();
        setItems(res.data.results || res.data || []);
        setError(null);
      } catch (err) {
        setError('Failed to load audit logs.',err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="audit-page">
      <div className="staff-header-row"><h2>Audit &amp; Compliance</h2></div>
      {error && <p className="page-error">{error}</p>}
      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No audit entries.</p>
      ) : (
        <table className="hr-table">
          <thead>
            <tr><th>ID</th><th>Action</th><th>Model</th><th>Object</th><th>By</th><th>Time</th><th>Changes</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td><span className={`status-badge status-${a.action}`}>{a.action}</span></td>
                <td>{a.model_name}</td>
                <td>{a.object_id}</td>
                <td>{a.performed_by ?? '—'}</td>
                <td>{a.timestamp ?? '—'}</td>
                <td className="audit-changes">{a.changes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Audit;
