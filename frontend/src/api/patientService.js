import api from './api';

const getAllPatients = (page, pageSize, sortOrder) => {
  return api.get('patients/patients/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder
    }
  });
};

const createPatient = (patientData) => {
  return api.post('patients/patients/', patientData);
};
const deletePatient = (id) => {
  return api.delete(`patients/patients/${id}/`);
};

const searchPatients = (query) => {
  return api.get('patients/patients/', { params: { search: query } });
};

const getPatientById = (id) => {
  return api.get(`patients/patients/${id}/`);
};

export const patientService = {
  getAllPatients,
  createPatient,
  deletePatient,
  searchPatients,
  getPatientById,
};