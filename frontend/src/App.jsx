/**
 * CMMS Thammasat - Main App
 * React 18 + React Router v6
 */
import './index.css';
import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import { useSocket } from './hooks/useSocket';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

// Lazy-load pages for code splitting
const DashboardPage   = lazy(() => import('./pages/DashboardPage'));
const EquipmentPage   = lazy(() => import('./pages/EquipmentPage'));
const EquipmentDetail = lazy(() => import('./pages/EquipmentDetail'));
const WorkOrdersPage  = lazy(() => import('./pages/WorkOrdersPage'));
const WorkOrderDetail = lazy(() => import('./pages/WorkOrderDetail'));
const DowntimePage    = lazy(() => import('./pages/DowntimePage'));
const InventoryPage   = lazy(() => import('./pages/InventoryPage'));
const PublicRepairPage = lazy(() => import('./pages/PublicRepairPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const KPIPage         = lazy(() => import('./pages/KPIPage'));
const LotoPage        = lazy(() => import('./pages/LotoPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem' }}>
      <div className="spinner" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  useSocket(); // Initialize WebSocket

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<DashboardPage />} />
          <Route path="equipment"       element={<EquipmentPage />} />
          <Route path="equipment/:id"   element={<EquipmentDetail />} />
          <Route path="work-orders"     element={<WorkOrdersPage />} />
          <Route path="work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="downtime"        element={<DowntimePage />} />
          <Route path="inventory"       element={<InventoryPage />} />
          <Route path="kpi"             element={<KPIPage />} />
          <Route path="loto"            element={<LotoPage />} />
          <Route path="admin"           element={<AdminPage />} />
        </Route>
        <Route path="/repair" element={<PublicRepairPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const { isAuthenticated, fetchMe } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) fetchMe();
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            fontSize: '13px',
            maxWidth: '380px',
          }
        }}
      />
    </BrowserRouter>
  );
}

export default App;
