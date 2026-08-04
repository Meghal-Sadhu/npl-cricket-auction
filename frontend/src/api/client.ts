import axios from 'axios';

// In production, VITE_API_URL is set to the Oracle Cloud backend URL
// In development, it defaults to the local backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const BACKEND_DOMAIN = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject JWT bearer token if stored
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper function for WebSocket connection
export const createAuctionSocket = (token?: string): WebSocket => {
  const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/auction';
  const wsUrl = `${wsBase}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  return new WebSocket(wsUrl);
};

// Helper for static image URLs
export const getImageUrl = (path?: string): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BACKEND_DOMAIN}${path}`;
};
