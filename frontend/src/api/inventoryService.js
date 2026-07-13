import api from './api';

const getAllMedicines = (page, pageSize, sortOrder) => {
  return api.get('inventory/medicines/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder
    }
  });
};
const createMedicine = (medicineData) => {
  return api.post('inventory/medicines/', medicineData);
};

const deleteMedicine = (id) => {
  return api.delete(`inventory/medicines/${id}/`);
};

const updateMedicine = (id, medicineData) => {
  return api.put(`inventory/medicines/${id}/`, medicineData);
};

export const inventoryService = {
  getAllMedicines, 
  createMedicine,
  deleteMedicine,
  updateMedicine,
};