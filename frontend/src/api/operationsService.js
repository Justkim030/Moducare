// src/api/operationsService.js
import api from './api';

// Operations exposes activities + calendar events under /api/v1/operations/
const getActivities = (params = {}) => api.get('operations/activities/', { params });
const getEvents = (params = {}) => api.get('operations/events/', { params });

export const operationsService = {
  getActivities,
  getEvents,
};
