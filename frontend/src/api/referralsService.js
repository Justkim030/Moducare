// src/api/referralsService.js
import api from './api';

const getReferrals = (params = {}) => api.get('referrals/', { params });
const createReferral = (data) => api.post('referrals/', data);
const updateReferral = (id, data) => api.patch(`referrals/${id}/`, data);

export const referralsService = {
  getReferrals,
  createReferral,
  updateReferral,
};
