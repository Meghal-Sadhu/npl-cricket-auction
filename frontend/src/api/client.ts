import axios from 'axios';

// Backend URL - must be set in Vercel project settings as environment variable
// VITE_API_URL      = https://<your-domain>/api  (production)
// VITE_WS_URL       = wss://<your-domain>/ws/auction  (production)
// VITE_BACKEND_URL  = https://<your-domain>  (for static file URLs)
const PROD_DOMAIN = '92-4-76-201.sslip.io';

const API_BASE = (import.meta.env.VITE_API_URL as string) || `https://${PROD_DOMAIN}/api`;
const BACKEND_DOMAIN = (import.meta.env.VITE_BACKEND_URL as string) || `https://${PROD_DOMAIN}`;
const WS_URL = (import.meta.env.VITE_WS_URL as string) || `wss://${PROD_DOMAIN}/ws/auction`;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Safely format API error detail strings/arrays/objects into renderable strings
export const formatApiError = (err: any, fallbackMsg: string = 'Operation failed'): string => {
  if (!err) return fallbackMsg;
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Server request timed out. Please check your internet connection and try again.';
  }
  const detail = err.response?.data?.detail;
  if (!detail) {
    return err.message || fallbackMsg;
  }
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.msg) return item.msg;
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return fallbackMsg;
};

// Inject JWT bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally for active sessions (skip login requests)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginAttempt = error.config?.url?.includes('/auth/login');
      if (!isLoginAttempt) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// WebSocket connection to auction backend
export const createAuctionSocket = (token?: string): WebSocket => {
  const wsUrl = `${WS_URL}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  return new WebSocket(wsUrl);
};

// Resolve static file/image URLs served by the backend
export const getImageUrl = (path?: string): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BACKEND_DOMAIN}${path}`;
};
