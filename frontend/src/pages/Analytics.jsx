// src/pages/Analytics.jsx
import React, { useState, useEffect } from 'react';
import { analyticsService } from '../api/analyticsService';

function Analytics() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await analyticsService.getMetrics();
        setItems(res.data.results || res.data || []);
        setError(null);
      } catch (err) {
        setError('Failed to load analytics metrics.', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="analytics-page">
      <div className="staff-header-row"><h2>Analytics &amp; Reports</h2></div>
      {error && <p className="page-error">{error}</p>}
      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No metrics recorded.</p>
      ) : (
        <table className="hr-table">
          <thead>
            <tr><th>Metric</th><th>Category</th><th>Value</th><th>Recorded</th></tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>{m.metric_name}</td>
                <td>{m.category || '—'}</td>
                <td>{m.value}</td>
                <td>{m.recorded_at ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Analytics;
