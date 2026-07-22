import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useSocketRooms } from '../hooks/useSocketRooms';
import { formatCurrency } from '../utils/currency';

export default function AdminOrders() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truckNames, setTruckNames] = useState({}); // id -> name

  async function load() {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, trucksRes] = await Promise.all([
        api.getOrders(token),
        api.getTrucks()
      ]);
      if (ordersRes.success) setOrders(ordersRes.data || []);

      // Build truck name map
      const nameMap = {};
      if (trucksRes.success) {
        (trucksRes.data || []).forEach(t => {
          const key = t.id || t._id;
          nameMap[key] = t.name;
        });
      }
      setTruckNames(nameMap);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, user]);

  const upsertOrder = useCallback((incoming) => {
    if (!incoming) return;
    const id = incoming._id || incoming.id;
    if (!id) return;
    setOrders(list => {
      const idx = list.findIndex(o => (o._id || o.id) === id);
      if (idx === -1) return [incoming, ...list];
      const next = list.slice();
      next[idx] = { ...next[idx], ...incoming };
      return next;
    });
  }, []);

  const handleOrderNew = useCallback(({ order }) => {
    upsertOrder(order);
  }, [upsertOrder]);

  const handleOrderUpdate = useCallback(({ orderId, order, status }) => {
    if (order) {
      upsertOrder(order);
      return;
    }
    if (!orderId) return;
    setOrders(list => list.map(o => (o._id || o.id) === orderId ? { ...o, status } : o));
  }, [upsertOrder]);

  const rooms = useMemo(() => (user?.role === 'admin' ? ['orders:admin'] : []), [user?.role]);
  const listeners = useMemo(() => ({
    'order:new': handleOrderNew,
    'order:update': handleOrderUpdate
  }), [handleOrderNew, handleOrderUpdate]);

  useSocketRooms({ token, rooms, listeners, enabled: Boolean(token && user?.role === 'admin') });

  if (!token) return <p style={{ padding: 20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding: 20 }}>Forbidden</p>;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>Admin • Orders</h2>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading orders…</p>}
      {error && <div style={{ color: 'var(--danger)', padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 20 }}>{error}</div>}

      {!loading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Truck</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const truckId = o.truckSnapshot?.id || (typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck);
                const truckName = o.truckName || o.truckSnapshot?.name || (truckNames[truckId] || shortId(truckId));
                const customerName = o.customerName || o.customerSnapshot?.name || shortId(o.customerSnapshot?.id);
                const customerEmail = o.customerSnapshot?.email || null;

                const statusBadgeMap = {
                  PLACED: 'badge-gray',
                  ACCEPTED: 'badge-yellow',
                  PREPARING: 'badge-yellow',
                  READY: 'badge-green',
                  COMPLETED: 'badge-green',
                  CANCELLED: 'badge-red',
                  DELIVERED: 'badge-green'
                };

                return (
                  <tr key={o._id}>
                    <td><code style={{ color: 'var(--primary)', fontWeight: 600 }}>#{shortId(o._id)}</code></td>
                    <td>
                      <strong>{customerName}</strong>
                      {customerEmail ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{customerEmail}</div> : null}
                    </td>
                    <td><strong>{truckName}</strong></td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(o.total || 0)}</td>
                    <td>
                      <span className={`badge ${statusBadgeMap[o.status] || 'badge-gray'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{o.placedDate ? `${o.placedDate} ${o.placedTime12 || ''}` : '—'}</td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function shortId(id) { return id ? String(id).slice(-6) : '—'; }
import { formatDate, formatTime12 } from '../utils/date';

function formatTS(ts) {
  if (!ts) return '—';
  return `${formatDate(ts)} ${formatTime12(ts)}`;
}
const th = { textAlign: 'left', padding: 6, background: '#f5f5f5', border: '1px solid #ddd', fontSize: 12 };
const td = { padding: 6, border: '1px solid #eee', fontSize: 13 };
