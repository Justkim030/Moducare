// src/api/accountService.js
import api from './api';

const getAllInvoices = async (page, pageSize, sortOrder, statusFilter) => {
  const response = await api.get('accounts/invoices/', {
    params: {
      page: page,
      page_size: pageSize,
      ordering: sortOrder,
      status: statusFilter
    }
  });
  return response;
};

const createInvoice = async (invoiceData) => {
  const response = await api.post('accounts/invoices/', invoiceData);
  return response;
};

const getInvoiceById = async (id) => {
  const response = await api.get(`accounts/invoices/${id}/`);
  return response;
};

const recordPayment = async (invoiceId, paymentData) => {
  const response = await api.post(`accounts/invoices/${invoiceId}/record_payment/`, paymentData);
  return response;
};

export const accountService = {
  getAllInvoices,
  createInvoice,
  getInvoiceById,
  recordPayment,
};