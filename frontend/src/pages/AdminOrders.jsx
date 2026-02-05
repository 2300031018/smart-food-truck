import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

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

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Admin • Orders</h2>
      {loading && <p>Loading orders…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead>
            <tr>
              <th style={th}>Order</th>
              <th style={th}>Truck</th>
              <th style={th}>Total</th>
              <th style={th}>Status</th>
              <th style={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const truckId = typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck;
              const truckName = typeof o.truck === 'object' ? o.truck.name : (truckNames[truckId] || shortId(truckId));
              return (
                <tr key={o._id} style={{ borderTop:'1px solid #eee' }}>
                  <td style={td}>{shortId(o._id)}</td>
                  <td style={td}>{truckName}</td>
                  <td style={td}>₹{Number(o.total || 0).toFixed(2)}</td>
                  <td style={td}>{o.status}</td>
                  <td style={td}>{formatTS(o.createdAt)}</td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr><td style={td} colSpan={5}>No orders found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function shortId(id) { return id ? String(id).slice(-6) : '—'; }
function formatTS(ts) {
  if (!ts) return '—';
  try {
    const date = new Date(ts);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}
const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
