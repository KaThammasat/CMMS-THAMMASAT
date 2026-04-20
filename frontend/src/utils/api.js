/**
 * CMMS API Client - uses relative /api/v1 path (nginx proxies to backend)
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cmms_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cmms_access_token');
      localStorage.removeItem('cmms_refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Equipment API
export const equipmentAPI = {
  list: (params) => api.get('/equipment', { params }),
  get: (id) => api.get(`/equipment/${id}`),
  update: (id, data) => api.patch(`/equipment/${id}`, data),
  predict: (id) => api.get(`/equipment/${id}/predict`),
};

// Work Orders API
export const workOrderAPI = {
  list: (params) => api.get('/work-orders', { params }),
  get: (id) => api.get(`/work-orders/${id}`),
  create: (data) => api.post('/work-orders', data),
  updateStatus: (id, data) => api.patch(`/work-orders/${id}/status`, data),
};

// KPI API
export const kpiAPI = {
  summary: (params) => api.get('/kpi/summary', { params }),
  equipment: (id, params) => api.get(`/kpi/equipment/${id}`, { params }),
};

// Downtime API
export const downtimeAPI = {
  list: (params) => api.get('/downtime', { params }),
  create: (data) => api.post('/downtime', data),
  close: (id, data) => api.patch(`/downtime/${id}/close`, data),
};

// LOTO API
export const lotoAPI = {
  list: (params) => api.get('/loto', { params }),
  create: (data) => api.post('/loto', data),
  updateStatus: (id, status) => api.patch(`/loto/${id}/status`, { status }),
};

// Alerts API
export const alertsAPI = {
  list: (params) => api.get('/alerts', { params }),
  markRead: (id) => api.patch(`/alerts/${id}/read`, {}),
  markAllRead: () => api.patch('/alerts/read-all', {}),
};

// Inventory API
export const inventoryAPI = {
  list: (params) => api.get('/inventory', { params }),
  create: (data) => api.post('/inventory', data),
  adjust: (data) => api.post('/inventory/adjust', data),
  receive: (id, data) => api.post(`/inventory/${id}/receive`, data),
};

// Reports API
export const reportsAPI = {
  equipmentSummary: (params) => api.get('/reports/equipment-summary', { params }),
  costAnalysis: (params) => api.get('/reports/cost-analysis', { params }),
};

export default api;
