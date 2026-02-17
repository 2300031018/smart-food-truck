import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useSocketRooms } from '../hooks/useSocketRooms';

export default function DashboardStaff(){
  const { token, user } = useAuth();
  const [truckData, setTruckData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.assignedTruck || !token) return;
    
    Promise.all([
      api.getTruck(user.assignedTruck),
      api.getOrders(token)
    ])
      .then(([truckRes, ordersRes]) => {
        if (truckRes.success) setTruckData(truckRes.data);
        if (ordersRes.success) {
          const filtered = (ordersRes.data || []).filter(o => {
            const tid = typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck;
            return tid === user.assignedTruck;
          });
          setOrders(filtered);
        }
      })
      .finally(() => setLoading(false));
  }, [user, token]);

  const room = useMemo(() => (user?.assignedTruck ? [`truck:${user.assignedTruck}`] : []), [user?.assignedTruck]);
  const handleOrderNew = useCallback(({ order }) => {
    if (!order) return;
    const tid = typeof order.truck === 'object' ? (order.truck.id || order.truck._id) : order.truck;
    if (tid !== user?.assignedTruck) return;
    setOrders(list => {
      const exists = list.some(o => (o._id || o.id) === (order._id || order.id));
      if (exists) return list;
      return [order, ...list];
    });
  }, [user?.assignedTruck]);

  const handleOrderUpdate = useCallback(({ orderId, status, order }) => {
    const incoming = order || (orderId ? { _id: orderId, status } : null);
    if (!incoming) return;
    const tid = typeof incoming.truck === 'object' ? (incoming.truck.id || incoming.truck._id) : incoming.truck;
    if (tid && tid !== user?.assignedTruck) return;
    setOrders(list => list.map(o => (o._id || o.id) === (incoming._id || incoming.id) ? { ...o, ...incoming } : o));
  }, [user?.assignedTruck]);

  const listeners = useMemo(() => ({
    'order:new': handleOrderNew,
    'order:update': handleOrderUpdate
  }), [handleOrderNew, handleOrderUpdate]);
  useSocketRooms({ token, rooms: room, listeners, enabled: Boolean(token && user?.assignedTruck) });

  const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
  const placedOrders = orders.filter(o => normalizeStatus(o.status) === 'PLACED').length;
  const acceptedOrders = orders.filter(o => normalizeStatus(o.status) === 'ACCEPTED').length;
  const preparingOrders = orders.filter(o => normalizeStatus(o.status) === 'PREPARING').length;
  const readyOrders = orders.filter(o => normalizeStatus(o.status) === 'READY').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>Staff Dashboard</h2>
      
      {user?.assignedTruck ? (
        <div>
          {truckData && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#1e40af' }}>
                <strong>Assigned Truck:</strong> {truckData.name}
              </p>
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#856404', marginBottom: 8 }}>Placed Orders</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff8c00' }}>{placedOrders}</div>
            </div>
            <div style={{ background: '#ede9fe', border: '1px solid #8b5cf6', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#5b21b6', marginBottom: 8 }}>Accepted</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#6d28d9' }}>{acceptedOrders}</div>
            </div>
            <div style={{ background: '#e2e3e5', border: '1px solid #6c757d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#383d41', marginBottom: 8 }}>Preparing</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#495057' }}>{preparingOrders}</div>
            </div>
            <div style={{ background: '#d1e7dd', border: '1px solid #198754', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#0f5132', marginBottom: 8 }}>Ready for Pickup</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#198754' }}>{readyOrders}</div>
            </div>
            <div style={{ background: '#cfe2ff', border: '1px solid #0d6efd', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#084298', marginBottom: 8 }}>Total Orders</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#0d6efd' }}>{orders.length}</div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Quick Stats</h4>
            <p style={{ margin: 8, fontSize: 14 }}>
              <strong>Revenue from orders:</strong> ₹{totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 6, padding: 12, color: '#854d0e' }}>
          You are not currently assigned to any truck. Please contact your manager.
        </div>
      )}
    </div>
  );
}