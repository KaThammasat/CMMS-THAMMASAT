/**
 * CMMS API Client
 * Centralized axios instance with auth + error handling
 */
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// ─── Request interceptor: attach JWT ─────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cmms_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// ─── Response interceptor: handle 401 / errors ───────────────
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      // In production: call refresh token endpoint here
      localStorage.removeItem('cmms_access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ─── Equipment ────────────────────────────────────────────────
export const equipmentAPI = {
  list: (params) => api.get('/equipment', { params }),
  get: (id) => api.get(`/equipment/${id}`),
  create: (data) => api.post('/equipment', data),
  update: (id, data) => api.patch(`/equipment/${id}`, data),
  predict: (id) => api.get(`/equipment/${id}/predict`),
  sensorHistory: (id, hours) => api.get(`/equipment/${id}/sensor-history`, { params: { hours } }),
};

// ─── Work Orders ──────────────────────────────────────────────
export const workOrderAPI = {
  list: (params) => api.get('/work-orders', { params }),
  get: (id) => api.get(`/work-orders/${id}`),
  create: (data) => api.post('/work-orders', data),
  updateStatus: (id, status, data) => api.patch(`/work-orders/${id}/status`, { status, ...data }),
  assign: (id, technician_id) => api.patch(`/work-orders/${id}/assign`, { technician_id }),
};

// ─── Downtime ─────────────────────────────────────────────────
export const downtimeAPI = {
  list: (params) => api.get('/downtime', { params }),
  start: (data) => api.post('/downtime', data),
  end: (id, data) => api.patch(`/downtime/${id}/end`, data),
};

// ─── KPI ──────────────────────────────────────────────────────
export const kpiAPI = {
  summary: (params) => api.get('/kpi/summary', { params }),
  downtimeTrend: (days) => api.get('/kpi/downtime-trend', { params: { days } }),
  failureByCategory: () => api.get('/kpi/failure-by-category'),
};

// ─── Inventory ────────────────────────────────────────────────
export const inventoryAPI = {
  list: (params) => api.get('/inventory', { params }),
  adjust: (data) => api.post('/inventory/adjust', data),
};

// ─── Alerts ───────────────────────────────────────────────────
export const alertsAPI = {
  list: (params) => api.get('/alerts', { params }),
  markRead: (id) => api.patch(`/alerts/${id}/read`),
  markAllRead: () => api.patch('/alerts/read-all'),
};

// ─── Reports ──────────────────────────────────────────────────
export const reportsAPI = {
  equipmentSummary: () => api.get('/reports/equipment-summary'),
  costAnalysis: (months) => api.get('/reports/cost-analysis', { params: { months } }),
};

// ─── LOTO ─────────────────────────────────────────────────────
export const lotoAPI = {
  list: (params) => api.get('/loto', { params }),
  initiate: (data) => api.post('/loto', data),
  isolate: (id, data) => api.patch(`/loto/${id}/isolate`, data),
  verify: (id, data) => api.patch(`/loto/${id}/verify`, data),
  release: (id) => api.patch(`/loto/${id}/release`),
};

export default api;
