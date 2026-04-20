/**
 * Global State - Zustand Store
 */
import { create } from 'zustand';
import { authAPI } from '../utils/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('cmms_access_token'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('cmms_access_token'),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authAPI.login(email, password);
      const { accessToken, user } = res.data.data || res.data;
      localStorage.setItem('cmms_access_token', accessToken);
      set({ user, token: accessToken, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.error || 'Login failed' };
    }
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('cmms_access_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const res = await authAPI.me();
      set({ user: res.data.data || res.data });
    } catch {
      get().logout();
    }
  }
}));

export const useAlertStore = create((set, get) => ({
  alerts: [],
  unreadCount: 0,

  addAlert: (alert) => set(state => ({
    alerts: [alert, ...state.alerts].slice(0, 50),
    unreadCount: state.unreadCount + 1
  })),

  clearUnread: () => set({ unreadCount: 0 }),
}));
