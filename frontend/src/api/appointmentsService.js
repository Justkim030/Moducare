// src/api/appointmentsService.js
import api from './api';

const getAppointments = (params = {}) => api.get('appointments/', { params });
const createAppointment = (data) => api.post('appointments/', data);
const updateAppointment = (id, data) => api.patch(`appointments/${id}/`, data);
const deleteAppointment = (id) => api.delete(`appointments/${id}/`);

export const appointmentsService = {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
