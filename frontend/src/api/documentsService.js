// src/api/documentsService.js
import api from './api';

// Documents has a FileField, so uploads go as multipart/form-data.
const getDocuments = (params = {}) => api.get('documents/', { params });

const uploadDocument = (formData) =>
  api.post('documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

const deleteDocument = (id) => api.delete(`documents/${id}/`);

export const documentsService = {
  getDocuments,
  uploadDocument,
  deleteDocument,
};
