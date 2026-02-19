import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Trucks from './pages/Trucks';
import TruckDetail from './pages/TruckDetail';
import MenuManage from './pages/MenuManage';
import Orders from './pages/Orders';
import Layout from './components/Layout';
import RoleRoute from './components/RoleRoute';
import DashboardAdmin from './pages/DashboardAdmin';
import AdminManagers from './pages/AdminManagers';
import AdminStaff from './pages/AdminStaff';
import AdminTrucks from './pages/AdminTrucks';
import AdminOrders from './pages/AdminOrders';
import DashboardManager from './pages/DashboardManager';
import ManagerStaff from './pages/ManagerStaff';
import StaffStock from './pages/StaffStock';
import { AuthProvider, useAuth } from './context/AuthContext';

function Protected({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function HomeRedirect() {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/trucks" replace />;
  const role = user?.role;
  const dest = role === 'admin' ? '/admin'
    : role === 'manager' ? '/manager'
      : role === 'staff' ? '/staff'
        : '/trucks';
  return <Navigate to={dest} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/trucks" element={<Trucks />} />
          <Route path="/trucks/:id" element={<TruckDetail />} />
          <Route path="/trucks/:id/menu-manage" element={<RoleRoute roles={['admin', 'manager']}><MenuManage /></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute roles={['admin']}><DashboardAdmin /></RoleRoute>} />
          <Route path="/manager" element={<RoleRoute roles={['manager']}><DashboardManager /></RoleRoute>} />
          <Route path="/manager/staff" element={<RoleRoute roles={['manager']}><ManagerStaff /></RoleRoute>} />
          <Route path="/staff/stock" element={<RoleRoute roles={['staff']}><StaffStock /></RoleRoute>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
