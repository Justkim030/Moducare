import axios from 'axios';

// 1. Grab your target endpoint from the environment or fall back safely
//const baseInput = import.meta.env.VITE_API_URL|| "https://dimar.pythonanywhere.com";
const baseInput = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 2. Clear out any accidental dual slash handles, then firmly lock down the api/v1 suffix path
const cleanBase = baseInput.replace(/\/$/, '');
const API_BASE_URL = cleanBase.includes('/api/v1') ? `${cleanBase}/` : `${cleanBase}/api/v1/`;

const api = axios.create({
  baseURL: API_BASE_URL, // Enforces exactly: 'https://dimar.pythonanywhere.com/api/v1/'
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to automatically attach your authentication token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;