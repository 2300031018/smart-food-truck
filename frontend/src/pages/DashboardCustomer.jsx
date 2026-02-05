import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function DashboardCustomer(){
  const { user, token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.getOrders(token),
      api.getReservations(token)
    ])
      .then(([ordersRes, reservationsRes]) => {
        if (ordersRes.success) setOrders(ordersRes.data || []);
        if (reservationsRes.success) setReservations(reservationsRes.data || []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const activeReservations = reservations.filter(r => !['cancelled', 'completed'].includes(r.status)).length;

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>Customer Dashboard</h2>
      
      <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 16, color: '#1b5e20' }}>
          Welcome, <strong>{user?.name || user?.email}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#856404', marginBottom: 8 }}>Active Orders</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff8c00' }}>{activeOrders}</div>
        </div>
        <div style={{ background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#0d47a1', marginBottom: 8 }}>Reservations</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1976d2' }}>{activeReservations}</div>
        </div>
        <div style={{ background: '#f3e5f5', border: '1px solid #9c27b0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#4a148c', marginBottom: 8 }}>Total Orders</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#7b1fa2' }}>{orders.length}</div>
        </div>
        <div style={{ background: '#e0f2f1', border: '1px solid #009688', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#004d40', marginBottom: 8 }}>Total Spent</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00897b' }}>₹{totalSpent.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Recent Activity</h4>
        {orders.length === 0 && reservations.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>No orders or reservations yet. Start by browsing trucks!</p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
            You have {orders.length} order{orders.length !== 1 ? 's' : ''} and {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </div>
  );
}