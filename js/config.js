/**
 * ModuCare MS — Configuration
 * Central configuration for environment-specific settings
 */

// Base API URL from environment or default
export const API_BASE_URL = () => {
  const base = window.location.origin;
  return process?.env?.API_BASE_URL || base;
};

// Currency configuration (production-ready)
export const CURRENCY = {
  code: 'KES',
  symbol: 'KSh',
  locale: 'en-KE'
};

// Dashboard metric defaults (will be overwritten by API)
export const DEFAULT_METRICS = {
  tasks: 0,
  appointments: 0,
  patients: 0,
  incidents: 0,
  notifications: 0,
  documents: 0,
  teamTasks: 0,
  totalOperations: 0,
  totalIncidents: 0,
  finance: 0
};