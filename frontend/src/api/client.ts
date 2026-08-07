import axios from 'axios';

// Backend URL - must be set in Vercel project settings as environment variable
// VITE_API_URL      = https://<your-domain>/api  (production)
// VITE_WS_URL       = wss://<your-domain>/ws/auction  (production)
// VITE_BACKEND_URL  = https://<your-domain>  (for static file URLs)
const API_BASE = import.meta.env.VITE_API_URL as string;
const BACKEND_DOMAIN = import.meta.env.VITE_BACKEND_URL as string;
const WS_URL = import.meta.env.VITE_WS_URL as string;

if (!API_BASE) {
  console.error(
    '[Config] VITE_API_URL is not set! Add it in Vercel project settings.\n' +
    'Example: https://92-4-76-201.sslip.io/api'
  );
}

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject JWT bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally (e.g. expired admin session)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (localStorage.getItem('access_token')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
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
