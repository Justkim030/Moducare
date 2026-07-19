import api from './api';

const getAllPatients = (page, pageSize, sortOrder) => {
  return api.get('patients/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder
    }
  });
};

const createPatient = (patientData) => {
  return api.post('patients/', patientData);
};
const deletePatient = (id) => {
  return api.delete(`patients/${id}/`);
};

const searchPatients = (query) => {
  return api.get('patients/', { params: { search: query } });
};

const getPatientById = (id) => {
  return api.get(`patients/${id}/`);
};

export const patientService = {
  getAllPatients,
  createPatient,
  deletePatient,
  searchPatients,
  getPatientById,
};