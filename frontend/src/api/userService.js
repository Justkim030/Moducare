// src/api/userService.js
import api from './api';

const getAllEmployees = (page, pageSize, sortOrder) => {
  return api.get('users/employees/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder
    }
  });
};
const createEmployee = (employeeData) => {
  return api.post('users/employees/', employeeData); // <-- And here
};

const deleteEmployee = (id) => {
  return api.delete(`users/employees/${id}/`); // <-- And here
};

const getMe = () => {
  return api.get('users/employees/me/');
};

const updateUser = (id, userData) => {
  return api.patch(`users/employees/${id}/`, userData);
};

export const userService = {
  getAllEmployees,
  createEmployee,
  deleteEmployee,
  getMe,
  updateUser,
};