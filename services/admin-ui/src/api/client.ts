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
  if (import.meta.env.DEV) {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
  }
  return config;
}, (error) => {
  if (import.meta.env.DEV) {
    console.error('[API Request Error]', error);
  }
  return Promise.reject(error);
});

// Add response interceptor to handle session expiration
apiClient.interceptors.response.use((response) => {
  if (import.meta.env.DEV) {
    console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
  }
  return response;
}, (error) => {
  if (import.meta.env.DEV) {
    console.error(`[API Response Error] ${error.response?.status} ${error.config?.url}`, error.response?.data || error.message);
  }
  if (error.response?.status === 401) {
    if (window.location.pathname !== '/login') {
        localStorage.removeItem('vexil_token');
        window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});
