// src/api/notificationsService.js
import api from './api';

const getNotifications = (params = {}) => api.get('notifications/', { params });
const markRead = (id) => api.patch(`notifications/${id}/`, { is_read: true });
const markAllRead = (ids) =>
  Promise.all(ids.map((id) => api.patch(`notifications/${id}/`, { is_read: true })));

export const notificationsService = {
  getNotifications,
  markRead,
  markAllRead,
};
