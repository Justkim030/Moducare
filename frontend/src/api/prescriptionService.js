import api from './api';

const getAllPrescriptions = (page, pageSize, sortOrder) => {
  return api.get('prescriptions/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder
    }
  });
};

const createPrescription = (prescriptionData) => {
  return api.post('prescriptions/', prescriptionData);
};

const addPrescriptionItem = (itemData) => {
  return api.post('prescriptions/items/', itemData);
};

const updatePrescriptionItem = (itemId, data) => {
  return api.patch(`prescriptions/items/${itemId}/`, data);
};

const deletePrescriptionItem = (itemId) => {
  return api.delete(`prescriptions/items/${itemId}/`);
};

const dispensePrescription = (id) => {
  return api.post(`prescriptions/${id}/dispense/`);
};

const markAsPaid = (id) => {
  return api.post(`prescriptions/${id}/mark_as_paid/`);
};

export const prescriptionService = {
  getAllPrescriptions,
  createPrescription,
  addPrescriptionItem,
  updatePrescriptionItem, 
  deletePrescriptionItem, 
  dispensePrescription,
  markAsPaid,
};