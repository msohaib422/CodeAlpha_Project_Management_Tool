import axios from 'axios';

// In production always use the same-origin /api path so requests stay on the
// Vercel domain (avoids CORS and localhost/external-URL mistakes).
// In development, allow VITE_API_URL to override (defaults to local backend).
const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Derive the server origin (without /api) for static assets such as uploads
export const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// Add a request interceptor to attach JWT token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default API;