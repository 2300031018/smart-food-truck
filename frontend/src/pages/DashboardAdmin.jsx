import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminTrucks from './AdminTrucks';
import AdminManagers from './AdminManagers';
import AdminStaff from './AdminStaff';
import AdminOrders from './AdminOrders';

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
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Admin Console</h2>
        <span style={{ fontSize: 14, color: '#666' }}>Logged in as {user?.email}</span>
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
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : 'none',
              color: activeTab === tab.id ? '#2563eb' : '#666',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 8 }}>
        <ActiveComponent />
      </div>
    </div>
  );
}
