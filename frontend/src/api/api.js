import axios from 'axios';

const baseInput = import.meta.env.VITE_API_URL || 'http://localhost:8000';


const cleanBase = baseInput.replace(/\/$/, '');
const API_BASE_URL = cleanBase.includes('/api/v1') ? `${cleanBase}/` : `${cleanBase}/api/v1/`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;