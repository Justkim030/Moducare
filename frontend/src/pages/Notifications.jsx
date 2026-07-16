// src/pages/Notifications.jsx
import React, { useState, useEffect } from 'react';
import { notificationsService } from '../api/notificationsService';
import Button from '../components/common/Button';
import './Notifications.css';

function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationsService.getNotifications();
      setItems(res.data.results || res.data || []);
      setError(null);
    } catch (e) {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      await notificationsService.markRead(id);
      load();
    } catch (e) {
      setError('Failed to mark as read.');
    }
  };

  const markAll = async () => {
    const unread = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!unread.length) return;
    try {
      await notificationsService.markAllRead(unread);
      load();
    } catch (e) {
      setError('Failed to mark all as read.');
    }
  };

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="notifications-page">
      <div className="staff-header-row">
        <h2>Notifications {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}</h2>
        <Button variant="edit" onClick={markAll} disabled={unreadCount === 0}>Mark all read</Button>
      </div>
      {error && <p className="page-error">{error}</p>}
      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No notifications.</p>
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={`notif-item ${n.is_read ? 'read' : 'unread'}`}>
              <div className="notif-body">
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{n.created_at ?? ''}</small>
              </div>
              {!n.is_read && (
                <Button variant="edit" onClick={() => markRead(n.id)}>Mark read</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Notifications;
