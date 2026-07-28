// src/api/incidentService.js
import api from './api';

export const incidentService = {
  getIncidentReports: (params = {}) => api.get('incident/', { params }),
};
