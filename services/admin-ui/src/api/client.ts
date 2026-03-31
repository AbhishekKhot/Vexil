import axios from 'axios';

// Base URL points to our backend API
export const apiClient = axios.create({
  baseURL: '/api', // Proxied in Vite config
  headers: {
    'Content-Type': 'application/json',
  },
});
