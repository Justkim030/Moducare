// src/pages/Operations.jsx
import React, { useState, useEffect } from 'react';
import { operationsService } from '../api/operationsService';

function Operations() {
  const [activities, setActivities] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('activities');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [aRes, eRes] = await Promise.all([
          operationsService.getActivities(),
          operationsService.getEvents(),
        ]);
        setActivities(aRes.data.results || aRes.data || []);
        setEvents(eRes.data.results || eRes.data || []);
        setError(null);
      } catch (e) {
        setError('Failed to load operations data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="operations-page">
      <div className="staff-header-row"><h2>Operations</h2></div>
      {error && <p className="page-error">{error}</p>}

      <div className="hr-tabs">
        <button className={`hr-tab ${tab === 'activities' ? 'active' : ''}`} onClick={() => setTab('activities')}>Activities</button>
        <button className={`hr-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Calendar Events</button>
      </div>

      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : tab === 'activities' ? (
        activities.length === 0 ? <p className="hr-muted">No activities.</p> : (
          <table className="hr-table">
            <thead><tr><th>ID</th><th>Type</th><th>Description</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.activity_type || a.type || '—'}</td>
                  <td>{a.description || '—'}</td>
                  <td><span className={`status-badge status-${a.status || 'default'}`}>{a.status || '—'}</span></td>
                  <td>{a.timestamp || a.created_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        events.length === 0 ? <p className="hr-muted">No calendar events.</p> : (
          <table className="hr-table">
            <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.id}</td>
                  <td>{e.title}</td>
                  <td>{e.event_type || '—'}</td>
                  <td>{e.start_time ?? '—'}</td>
                  <td>{e.end_time ?? '—'}</td>
                  <td><span className={`status-badge status-${e.status || 'default'}`}>{e.status || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

export default Operations;
