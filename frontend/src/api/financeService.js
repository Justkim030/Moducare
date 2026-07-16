// src/api/financeService.js
import api from './api';

const getTransactions = (params = {}) => api.get('finance/', { params });
const createTransaction = (data) => api.post('finance/', data);
const deleteTransaction = (id) => api.delete(`finance/${id}/`);

export const financeService = {
  getTransactions,
  createTransaction,
  deleteTransaction,
};
