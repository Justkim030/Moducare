import api from './api';

const getVisits = (pageOrStatus, pageSize, sortOrder, statusFilter = '') => {
  let params = {};
  if (typeof pageOrStatus === 'string') {
    params = { status: pageOrStatus };
  } else {
    params = {
      page: pageOrStatus,
      page_size: pageSize,
      ordering: sortOrder,
      status: statusFilter
    };
  }
  return api.get(`visits/visits/`, { params });
};

const createVisit = (visitData) => {
  return api.post('visits/visits/', visitData);
};

const getVisitById = (id) => {
  return api.get(`visits/visits/${id}/`);
};


const saveConsultationReport = (id, data) => {

  return api.post(`visits/visits/${id}/save_report/`, data);
};

export const visitService = {
  getVisits,
  createVisit,
  getVisitById,
  saveConsultationReport
};