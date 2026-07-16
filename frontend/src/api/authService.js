import api from './api';

const login = async (email, password) => {
  const baseURL = api.defaults.baseURL.replace(/\/api\/v1\/$/, '');
  const response = await fetch(`${baseURL}/api/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }

  const data = await response.json();

  if (data.token) {
    localStorage.setItem('authToken', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  }
  return data;
};

const getCurrentUser = async () => {
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