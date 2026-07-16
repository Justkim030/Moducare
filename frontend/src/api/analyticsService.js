// src/api/analyticsService.js
import api from './api';

// Read-only metrics backed by /api/v1/analytics/
const getMetrics = (params = {}) => api.get('analytics/', { params });

export const analyticsService = {
  getMetrics,
};
