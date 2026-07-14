// src/api/incidentService.js
import axios from 'axios'; // Assuming you are using axios like the other services

export const incidentService = {
  getIncidentReports: async () => {
    // If you are using a standard axios instance with interceptors, use that instead
    return axios.get('/api/v1/incident/reports/');
  }
};