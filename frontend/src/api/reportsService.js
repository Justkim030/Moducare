// src/api/reportsService.js
import api from './api';

const getReports = (params = {}) => api.get('reports/', { params });
const getReport = (id) => api.get(`reports/${id}/`);

export const reportsService = {
  getReports,
  getReport,
};
