import api from './api';

const login = async (username, password) => {
  // 🟢 Relative path (No leading slash) chains perfectly into /api/v1/
  const response = await api.post('get-token/', { 
    username,
    password,
  });
  
  if (response.data.token) {
    localStorage.setItem('authToken', response.data.token);
    api.defaults.headers.common['Authorization'] = `Token ${response.data.token}`;
  }
  return response.data;
};

const getCurrentUser = async () => {
  // 🟢 Relative path (No leading slash)
  const response = await api.get('users/employees/me/');
  return response.data;
};

const logout = () => {
  localStorage.removeItem('authToken');
  delete api.defaults.headers.common['Authorization'];
};

export const authService = {
  login,
  logout,
  getCurrentUser,
};