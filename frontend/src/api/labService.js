// src/api/labService.js
import api from './api';

// --- Test Catalog (Definitions) ---
const getAvailableTests = () => {
  return api.get('lab/tests/');
};

const createLabTest = (testData) => {
  return api.post('lab/tests/', testData);
};

const deleteLabTest = (id) => {
  return api.delete(`lab/tests/${id}/`);
};

// --- Test Requests (Patient Data) ---
const getTestRequests = (page, pageSize, statusFilter) => {
  return api.get('lab/requests/', {
    params: {
      page: page,
      page_size: pageSize,
      status: statusFilter
    }
  });
};

const createTestRequest = (requestData) => {
  return api.post('lab/requests/', requestData);
};

const completeTest = (id, resultNotes) => {
  return api.post(`lab/requests/${id}/complete_test/`, { result_notes: resultNotes });
};

export const labService = {
  getAvailableTests,
  createLabTest,
  deleteLabTest,
  getTestRequests,
  createTestRequest,
  completeTest,
};