import React, { useEffect, useState, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';

// Lazy load tab components
const AdminTrucks = React.lazy(() => import('./AdminTrucks'));
const AdminManagers = React.lazy(() => import('./AdminManagers'));
const AdminStaff = React.lazy(() => import('./AdminStaff'));
const AdminOrders = React.lazy(() => import('./AdminOrders'));

// Loading component for tabs
const TabLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '500px',
    color: '#64748b'
  }}>
    <div style={{
      width: '30px',
      height: '30px',
      border: '3px solid #e2e8f0',
      borderTop: '3px solid var(--primary)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
  </div>
);

export default function DashboardAdmin() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('trucks');

  if (!token) return <p style={{ padding: 20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding: 20 }}>Forbidden</p>;

  const tabs = [
    { id: 'trucks', label: 'Trucks', component: AdminTrucks },
    { id: 'managers', label: 'Managers', component: AdminManagers },
    { id: 'staff', label: 'Staff', component: AdminStaff },
    { id: 'orders', label: 'Orders', component: AdminOrders },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab).component;

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Admin Console</h2>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Logged in as {user?.name || user?.email}</span>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 20 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <Suspense fallback={<TabLoader />}>
          <ActiveComponent />
        </Suspense>
      </div>
    </div>
  );
}
