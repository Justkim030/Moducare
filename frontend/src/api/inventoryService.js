import api from './api';

const getAllMedicines = (page, pageSize, sortOrder) => {
  return api.get('inventory/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder
    }
  });
};
const createMedicine = (medicineData) => {
  return api.post('inventory/', medicineData);
};

const deleteMedicine = (id) => {
  return api.delete(`inventory/${id}/`);
};

const updateMedicine = (id, medicineData) => {
  return api.put(`inventory/${id}/`, medicineData);
};

export const inventoryService = {
  getAllMedicines, 
  createMedicine,
  deleteMedicine,
  updateMedicine,
};