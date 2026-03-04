import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense } from 'react';

// Eagerly loaded (init/auth pages)
import Login from './pages/Login';
import Signup from './pages/Signup';
import Layout from './components/Layout';
import RoleRoute from './components/RoleRoute';

// Lazy loaded pages (heavy components)
const Home = React.lazy(() => import('./pages/Home'));
const Trucks = React.lazy(() => import('./pages/Trucks'));
const TruckDetail = React.lazy(() => import('./pages/TruckDetail'));
const MenuManage = React.lazy(() => import('./pages/MenuManage'));
const Orders = React.lazy(() => import('./pages/Orders'));
const OrderTracking = React.lazy(() => import('./pages/OrderTracking'));
const DashboardAdmin = React.lazy(() => import('./pages/DashboardAdmin'));
const AdminManagers = React.lazy(() => import('./pages/AdminManagers'));
const AdminStaff = React.lazy(() => import('./pages/AdminStaff'));
const AdminTrucks = React.lazy(() => import('./pages/AdminTrucks'));
const AdminOrders = React.lazy(() => import('./pages/AdminOrders'));
const DashboardManager = React.lazy(() => import('./pages/DashboardManager'));
const ManagerStaff = React.lazy(() => import('./pages/ManagerStaff'));
const AnalyticsDashboard = React.lazy(() => import('./pages/AnalyticsDashboard'));
const StaffStock = React.lazy(() => import('./pages/StaffStock'));

// Loading fallback component
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    flexDirection: 'column',
    gap: '1rem'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #e2e8f0',
      borderTop: '4px solid #ff6b6b',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading...</p>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

import { AuthProvider, useAuth } from './context/AuthContext';

function Protected({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function HomeRedirect() {
  const { token, user } = useAuth();
  if (!token) return (
    <Suspense fallback={<LoadingSpinner />}>
      <Home />
    </Suspense>
  );

  const role = user?.role;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'manager') return <Navigate to="/manager" replace />;
  if (role === 'staff') return <Navigate to="/orders" replace />;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Home />
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={
            <HomeRedirect />
          } />
          <Route path="/home" element={<Suspense fallback={<LoadingSpinner />}><Home /></Suspense>} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/trucks" element={<Suspense fallback={<LoadingSpinner />}><Trucks /></Suspense>} />
          <Route path="/trucks/:id" element={<Suspense fallback={<LoadingSpinner />}><TruckDetail /></Suspense>} />
          <Route path="/trucks/:id/menu-manage" element={<RoleRoute roles={['admin', 'manager']}><Suspense fallback={<LoadingSpinner />}><MenuManage /></Suspense></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute roles={['admin']}><Suspense fallback={<LoadingSpinner />}><DashboardAdmin /></Suspense></RoleRoute>} />
          <Route path="/manager" element={<RoleRoute roles={['manager']}><Suspense fallback={<LoadingSpinner />}><DashboardManager /></Suspense></RoleRoute>} />
          <Route path="/manager/staff" element={<RoleRoute roles={['manager']}><Suspense fallback={<LoadingSpinner />}><ManagerStaff /></Suspense></RoleRoute>} />
          <Route path="/staff/stock" element={<RoleRoute roles={['staff']}><Suspense fallback={<LoadingSpinner />}><StaffStock /></Suspense></RoleRoute>} />
          <Route path="/orders" element={<Protected><Suspense fallback={<LoadingSpinner />}><Orders /></Suspense></Protected>} />
          <Route path="/orders/:id" element={<Protected><Suspense fallback={<LoadingSpinner />}><OrderTracking /></Suspense></Protected>} />
          <Route path="/analytics" element={<RoleRoute roles={['admin', 'manager']}><Suspense fallback={<LoadingSpinner />}><AnalyticsDashboard /></Suspense></RoleRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
