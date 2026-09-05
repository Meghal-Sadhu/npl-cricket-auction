import { create } from 'zustand';
import { User } from '../types';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: true,

  login: (token, user) => {
    localStorage.setItem('access_token', token);
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  fetchCurrentUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token || token === 'null' || token === 'undefined') {
      localStorage.removeItem('access_token');
      set({ isLoading: false, isAuthenticated: false, user: null, token: null });
      return;
    }
    try {
      const res = await api.get<User>('/auth/me', { timeout: 6000 });
      if (res.data && res.data.id) {
        set({ user: res.data, isAuthenticated: true, isLoading: false });
      } else {
        throw new Error('Invalid user profile response');
      }
    } catch (err) {
      console.error('Failed to fetch user session:', err);
      localStorage.removeItem('access_token');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
