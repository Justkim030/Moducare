// src/api/wardService.js
import api from './api';

const getAdmittedPatients = (page, pageSize) => {
  return api.get('visits/', {
    params: {
      page,
      page_size: pageSize,
      status: 'ADMITTED' // Filters for In-Patients
    }
  });
};

const addWardLog = (logData) => {
  return api.post('visits/ward-logs/', logData);
};

const getWardLogs = (visitId) => {
  return api.get('visits/ward-logs/', { params: { visit_id: visitId } });
};

const dischargePatient = (visitId) => {
  // Patch the status to DISCHARGED
  return api.patch(`visits/${visitId}/`, { status: 'DISCHARGED' });
};

export const wardService = {
  getAdmittedPatients,
  addWardLog,
  getWardLogs,
  dischargePatient,
};