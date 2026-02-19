import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function DashboardCustomer() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    setLoading(true);
    api.getOrders(token)
      .then(res => { if (mounted && res.success) setOrders(res.data || []); })
      .catch(() => { /* ignore for now */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
  const activeOrders = orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(normalizeStatus(o.status))).length;
  const averageOrderValue = orders.length ? (totalSpent / orders.length).toFixed(2) : '0.00';

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>Customer Dashboard</h2>
      <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 16, color: '#1b5e20' }}>
          Welcome, <strong>{user?.name || user?.email || 'Customer'}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#856404', marginBottom: 8 }}>My Active Orders</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff8c00' }}>{activeOrders}</div>
        </div>
        <div style={{ background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#0d47a1', marginBottom: 8 }}>Order History</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1976d2' }}>{orders.length}</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Recent Activity</h4>
        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>No orders yet. Start by browsing trucks!</p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
            You have {orders.length} order{orders.length !== 1 ? 's' : ''} on record.
          </p>
        )}
      </div>
    </div>
  );
}