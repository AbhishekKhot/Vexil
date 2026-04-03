import axios from 'axios';

// Base URL points to our backend API
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('vexil_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to handle session expiration
apiClient.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response?.status === 401) {
    if (window.location.pathname !== '/login') {
        localStorage.removeItem('vexil_token');
        window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});
