// src/api/auditService.js
import api from './api';

// Read-only audit log backed by /api/v1/audit/
const getAuditLogs = (params = {}) => api.get('audit/', { params });

export const auditService = {
  getAuditLogs,
};
