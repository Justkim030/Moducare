// src/api/hrService.js
import api from './api';

// All HR endpoints are backed by the existing /api/v1/hr/* ViewSets.
// Note: HR resources key off `hr.Staff` (the `employee` FK), while the
// identity directory uses `users/employees/` (the `Employee` record). We
// bridge the two via the `user` PK so the UI can show real names.

const getStaff = () => api.get('hr/staff/');
const getEmployees = () => api.get('users/employees/');

const getLeaves = (params = {}) => api.get('hr/leave/', { params });
const createLeave = (data) => api.post('hr/leave/', data);
const updateLeave = (id, data) => api.patch(`hr/leave/${id}/`, data);

const getAttendance = (params = {}) => api.get('hr/attendance/', { params });
const createAttendance = (data) => api.post('hr/attendance/', data);
const updateAttendance = (id, data) => api.patch(`hr/attendance/${id}/`, data);

// Build a lookup of user PK -> { staffId, name } so leave/attendance rows
// (which only carry an `employee` Staff PK) can be labelled with a name.
const loadEmployeeDirectory = async () => {
  const [staffRes, empRes] = await Promise.all([getStaff(), getEmployees()]);
  const staffList = staffRes.data.results || staffRes.data || [];
  const empList = empRes.data.results || empRes.data || [];

  const userToStaff = {};
  const userToName = {};
  empList.forEach((e) => {
    const uid = e.user?.id;
    if (uid) {
      userToName[uid] = e.user?.name
        ? `${e.user.name.first_name || ''} ${e.user.name.second_name || ''}`.trim()
        : e.user?.username || 'Unknown';
    }
  });
  staffList.forEach((s) => {
    const uid = s.user;
    if (uid) {
      userToStaff[uid] = s.id;
      if (!userToName[uid]) {
        userToName[uid] = s.position || `Staff #${s.id}`;
      }
    }
  });
  return { userToStaff, userToName, staffList, empList };
};

export const hrService = {
  getStaff,
  getEmployees,
  getLeaves,
  createLeave,
  updateLeave,
  getAttendance,
  createAttendance,
  updateAttendance,
  loadEmployeeDirectory,
};
