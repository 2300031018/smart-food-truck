import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { useSocketRooms } from '../hooks/useSocketRooms';
import { useLiveEta } from '../hooks/useLiveEta';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTravelMinutes(distanceKm, mode) {
  const speeds = { walking: 4.5, driving: 25, cycling: 12 };
  const speed = speeds[mode] || speeds.driving;
  const hours = distanceKm / speed;
  return Math.max(1, Math.round(hours * 60));
}

function normalizeOrderStatus(status) {
  const key = String(status || '').trim().toUpperCase();
  const map = {
    PENDING: 'PLACED',
    ACCEPTED: 'ACCEPTED',
    PREPARING: 'PREPARING',
    READY: 'READY',
    DELIVERED: 'COMPLETED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  };
  return map[key] || key;
}

function PickupPlanner({ order, coords, defaultPrep = 20 }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('driving');
  const [prepMin, setPrepMin] = useState(defaultPrep);
  const [myPos, setMyPos] = useState(null);
  const [etaMin, setEtaMin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const live = useLiveEta({
    origin: myPos,
    destination: coords,
    mode: mode.toUpperCase()
  });

  useEffect(() => {
    if (!myPos || !coords) { setEtaMin(null); return; }
    if (live.status === 'ok' && typeof live.minutes === 'number') {
      setEtaMin(live.minutes);
      return;
    }
    const d = haversineKm(myPos.lat, myPos.lng, coords.lat, coords.lng);
    setEtaMin(estimateTravelMinutes(d, mode));
  }, [myPos, coords?.lat, coords?.lng, mode, live.status, live.minutes]);

  function useMyLocation() {
    setErr(null); setBusy(true);
    if (!('geolocation' in navigator)) { setErr('Geolocation not supported'); setBusy(false); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setBusy(false);
    }, e => { setErr(e.message || 'Failed to get location'); setBusy(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 });
  }

  const suggestion = (() => {
    if (!etaMin) return null;
    if (normalizeOrderStatus(order.status) === 'READY') return 'Order is ready — start now to pick up.';
    const diff = prepMin - etaMin;
    if (diff > 0) return `Leave in ~${diff} min to arrive when it’s ready.`;
    if (diff === 0) return 'Start now to arrive when it’s ready.';
    return `Start now (you’ll reach ~${Math.abs(diff)} min before it’s ready).`;
  })();

  const mapsUrl = (() => {
    if (!myPos || !coords) return null;
    const origin = `${myPos.lat},${myPos.lng}`;
    const dest = `${coords.lat},${coords.lng}`;
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(origin)}%3B${encodeURIComponent(dest)}`;
  })();

  if (!coords) return null;
  return (
    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Plan Pickup</strong>
        <button type="button" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Plan'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12 }}>Mode
              <select value={mode} onChange={e => setMode(e.target.value)} style={{ marginLeft: 6 }}>
                <option value="driving">Driving</option>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
              </select>
            </label>
            <label style={{ fontSize: 12 }}>Prep (min)
              <input type="number" min={1} max={180} value={prepMin} onChange={e => setPrepMin(Number(e.target.value) || defaultPrep)} style={{ width: 70, marginLeft: 6 }} />
            </label>
            <button type="button" onClick={useMyLocation} disabled={busy}>{busy ? 'Locating…' : (myPos ? 'Update my location' : 'Use my location')}</button>
          </div>
          <div style={{ fontSize: 13, color: '#111', display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            {etaMin ? (
              <>
                <span>
                  ETA to truck: <strong>{etaMin} min</strong>
                </span>
                {suggestion && <span>· {suggestion}</span>}
              </>
            ) : (
              <span style={{ opacity: .7 }}>Get ETA by using your location.</span>
            )}
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Open route in OpenStreetMap</a>
          )}
          {err && <div style={{ color: '#b91c1c', fontSize: 12 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truckNames, setTruckNames] = useState({});
  const [trucksById, setTrucksById] = useState({});
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const prevStatusRef = useRef({});
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      api.getOrders(token),
      api.getTrucks()
    ])
      .then(async ([ordersRes, trucksRes]) => {
        if (!mounted) return;
        let filteredOrders = ordersRes.data || [];
        if (user?.role === 'staff' && user?.assignedTruck) {
          const assignedTruckId = user.assignedTruck;
          filteredOrders = filteredOrders.filter(o => {
            const tid = typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck;
            return tid === assignedTruckId;
          });
        }
        if (ordersRes.success) {
          setOrders(filteredOrders);
          const map = {};
          filteredOrders.forEach(o => { map[o._id] = o.status; });
          prevStatusRef.current = map;
        }
        const nameMap = {};
        const byId = {};
        if (trucksRes.success) {
          (trucksRes.data || []).forEach(t => { const key = t.id || t._id; nameMap[key] = t.name; byId[key] = t; });
        }
        if (ordersRes.success) {
          const missingIds = new Set();
          for (const o of filteredOrders) {
            const tid = typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck;
            if (tid && !byId[tid]) missingIds.add(tid);
          }
          if (missingIds.size) {
            const fetched = await Promise.all(Array.from(missingIds).map(id => api.getTruck(id).catch(() => null)));
            fetched.forEach(resp => {
              if (resp && resp.success && resp.data) {
                const t = resp.data; const key = t.id || t._id; nameMap[key] = t.name; byId[key] = t;
              }
            });
          }
        }
        setTruckNames(nameMap);
        setTrucksById(byId);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [token, user]);

  useEffect(() => {
    if (user?.role !== 'customer') return;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch { }
      }
    }
  }, [user]);

  const trackedTruckIds = useMemo(() => {
    const ids = new Set();
    if (user?.assignedTruck) ids.add(user.assignedTruck);
    orders.forEach(o => {
      const tid = getTruckId(o);
      if (tid) ids.add(tid);
    });
    return Array.from(ids).sort();
  }, [orders, user?.assignedTruck]);

  const roomList = useMemo(() => {
    const rooms = new Set();
    const userId = user?.id || user?._id;
    if (user?.role === 'customer' && userId) rooms.add(`user:${userId}`);
    if (user?.role === 'staff' && user?.assignedTruck) rooms.add(`truck:${user.assignedTruck}`);
    if (user?.role === 'manager' && userId) rooms.add(`orders:manager:${userId}`);
    if (user?.role === 'admin') rooms.add('orders:admin');
    trackedTruckIds.forEach(id => rooms.add(`truck:${id}`));
    return Array.from(rooms);
  }, [user?.role, user?.assignedTruck, user?.id, user?._id, trackedTruckIds]);

  const shouldIncludeOrder = useCallback((incoming) => {
    if (!incoming) return false;
    if (user?.role === 'staff' && user?.assignedTruck) {
      const tid = getTruckId(incoming);
      return tid === user.assignedTruck;
    }
    return true;
  }, [user?.role, user?.assignedTruck]);

  const upsertOrder = useCallback((incoming) => {
    if (!incoming || !shouldIncludeOrder(incoming)) return;
    const id = incoming._id || incoming.id;
    if (!id) return;
    setOrders(list => {
      const idx = list.findIndex(o => (o._id || o.id) === id);
      if (idx === -1) return [incoming, ...list];
      const next = list.slice();
      next[idx] = { ...next[idx], ...incoming };
      return next;
    });
  }, [shouldIncludeOrder]);

  const handleStatusNotify = useCallback((orderId, nextStatus, orderForNotify) => {
    if (user?.role !== 'customer') return;
    const prev = prevStatusRef.current[orderId];
    const nextKey = normalizeOrderStatus(nextStatus);
    const prevKey = normalizeOrderStatus(prev);
    if (nextKey === 'READY' && prevKey !== 'READY' && prevKey !== 'COMPLETED' && prevKey !== 'CANCELLED' && !notifiedRef.current.has(orderId)) {
      notifyReady({ ...(orderForNotify || { _id: orderId }), status: nextKey });
      notifiedRef.current.add(orderId);
    }
    prevStatusRef.current[orderId] = nextKey;
  }, [user?.role]);

  const onOrderNew = useCallback(({ order }) => {
    if (!order) return;
    upsertOrder(order);
    if (order._id && order.status) handleStatusNotify(order._id, order.status, order);
  }, [upsertOrder, handleStatusNotify]);

  const onOrderUpdate = useCallback(({ orderId, status, order }) => {
    const incoming = order || (orderId ? { _id: orderId, status } : null);
    if (!incoming) return;
    upsertOrder(incoming);
    const id = orderId || incoming._id;
    if (id && (status || incoming.status)) {
      handleStatusNotify(id, status || incoming.status, incoming);
    }
  }, [upsertOrder, handleStatusNotify]);

  const onTruckLoc = useCallback(({ truckId, liveLocation }) => {
    setTrucksById(map => ({ ...map, [truckId]: { ...(map[truckId] || {}), id: truckId, liveLocation } }));
  }, []);

  const listeners = useMemo(() => ({
    'order:new': onOrderNew,
    'order:update': onOrderUpdate,
    'truck:location': onTruckLoc
  }), [onOrderNew, onOrderUpdate, onTruckLoc]);

  useSocketRooms({ token, rooms: roomList, listeners, enabled: Boolean(token && user?.role) });

  function notifyReady(order) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const title = 'Your order is ready for pickup';
    const body = `${orderCode(order)} at ${truckLabel(order)}`;
    try {
      const n = new Notification(title, { body, tag: order._id });
      n.onclick = () => {
        window.focus();
        const truckId = typeof order.truck === 'object' ? (order.truck.id || order.truck._id) : order.truck;
        if (truckId) window.open(`/trucks/${truckId}`, '_blank');
        n.close();
      };
    } catch { }
  }

  function getNextStatus(current) {
    const key = normalizeOrderStatus(current);
    const flow = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];
    const idx = flow.indexOf(key);
    if (idx === -1 || idx === flow.length - 1) return null;
    return flow[idx + 1];
  }

  async function advanceStatus(order) {
    const next = getNextStatus(order.status);
    if (!next) return;
    try {
      const res = await api.updateOrderStatus(token, order._id, next);
      if (res.success) {
        setOrders(o => o.map(or => or._id === order._id ? { ...or, status: next } : or));
      }
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleCancelOrder(order) {
    const reason = window.prompt(`Are you sure you want to cancel order ${orderCode(order)}? Please provide a reason:`,
      user?.role === 'customer' ? 'Customer cancelled' : 'Manager cancelled');

    if (reason === null) return; // Cancelled prompt

    try {
      const res = await api.updateOrderStatus(token, order._id, 'CANCELLED');
      if (res.success) {
        setOrders(o => o.map(or => or._id === order._id ? { ...or, status: 'CANCELLED' } : or));
      }
    } catch (e) {
      alert(e.message || 'Failed to cancel order');
    }
  }

  function toggleExpand(orderId) {
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setExpandedOrders(newSet);
  }

  function shortId(id) { return typeof id === 'string' ? id.slice(-6) : ''; }
  function orderCode(o) { const sid = shortId(o._id || ''); return sid ? `ORD-${sid.toUpperCase()}` : 'ORD-—'; }
  function pickupCode(o) { const sid = shortId(o._id || ''); return sid ? sid.toUpperCase() : '—'; }
  function getTruckId(o) { return typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck; }
  function getTruckObj(o) { const id = getTruckId(o); return (typeof o.truck === 'object' ? o.truck : trucksById[id]) || null; }
  function truckLabel(o) {
    if (o.truck && typeof o.truck === 'object') return o.truck.name || shortId(o.truck.id || o.truck._id || '');
    if (typeof o.truck === 'string') return truckNames[o.truck] || shortId(o.truck);
    return '—';
  }
  function coords(o) {
    const t = getTruckObj(o);
    const live = t?.liveLocation; const base = t?.location;
    const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
    const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
    return (lat !== null && lng !== null) ? { lat, lng } : null;
  }
  function prepDefault(o) {
    const candidates = [o.estimatedPrepMinutes, o.prepMinutes, o.prepTimeMin, o.prepTime];
    for (const c of candidates) { if (typeof c === 'number' && c > 0) return c; }
    return 20;
  }
  function displayStatus(status) {
    const key = normalizeOrderStatus(status);
    if (user?.role !== 'customer') return key || status;
    const map = { PLACED: 'placed', ACCEPTED: 'accepted', PREPARING: 'preparing', READY: 'ready for pickup', COMPLETED: 'picked up', CANCELLED: 'cancelled' };
    return map[key] || key || status;
  }

  const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
  const activeOrders = orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(normalizeStatus(o.status))).length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  const placedOrders = orders.filter(o => normalizeStatus(o.status) === 'PLACED').length;
  const acceptedOrders = orders.filter(o => normalizeStatus(o.status) === 'ACCEPTED').length;
  const preparingOrders = orders.filter(o => normalizeStatus(o.status) === 'PREPARING').length;
  const readyOrders = orders.filter(o => normalizeStatus(o.status) === 'READY').length;

  if (loading) return <p style={{ padding: 20 }}>Loading orders...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;

  const isStaff = user?.role === 'staff';
  const isCustomer = user?.role === 'customer';


  return (
    <div style={{ padding: 20 }}>
      <h2>Orders ({orders.length})</h2>

      {isCustomer && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#856404', marginBottom: 8 }}>Active Orders</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff8c00' }}>{activeOrders}</div>
          </div>
          <div style={{ background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#0d47a1', marginBottom: 8 }}>Total Orders</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1976d2' }}>{orders.length}</div>
          </div>
        </div>
      )}

      {isStaff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#856404', marginBottom: 4 }}>Placed</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff8c00' }}>{placedOrders}</div>
          </div>
          <div style={{ background: '#ede9fe', border: '1px solid #8b5cf6', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#5b21b6', marginBottom: 4 }}>Accepted</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#6d28d9' }}>{acceptedOrders}</div>
          </div>
          <div style={{ background: '#e2e3e5', border: '1px solid #6c757d', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#383d41', marginBottom: 4 }}>Preparing</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#495057' }}>{preparingOrders}</div>
          </div>
          <div style={{ background: '#d1e7dd', border: '1px solid #198754', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#0f5132', marginBottom: 4 }}>Ready</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#198754' }}>{readyOrders}</div>
          </div>
          <div style={{ background: '#cfe2ff', border: '1px solid #0d6efd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#084298', marginBottom: 4 }}>Revenue Today</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0d6efd' }}>₹{totalRevenue.toFixed(2)}</div>
          </div>
        </div>
      )}

      {isCustomer && (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: '8px 10px', borderRadius: 6, margin: '8px 0 12px' }}>
          Pickup only: collect your order from the truck.
        </div>
      )}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'system-ui' }}>
        <thead>
          <tr>
            <th style={th}>Order #</th>
            {user?.role === 'customer' ? (
              <>
                <th style={th}>Truck</th>
                <th style={th}>Status</th>
                <th style={th}>Total</th>
                <th style={th}>Pickup</th>
              </>
            ) : (
              <>
                <th style={{ ...th }}>{user?.role === 'staff' ? '' : 'Truck'}</th>
                <th style={th}>Status</th>
                <th style={th}>Total</th>
                <th style={th}>Details</th>
                <th style={th}>Action</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const isExpanded = expandedOrders.has(o._id);
            const isStaff = user?.role === 'staff';
            const tid = getTruckId(o);
            return (
              <React.Fragment key={o._id}>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={td}>
                    <div><span>{orderCode(o)}</span></div>
                    <div style={{ fontSize: 11, opacity: .7 }}>Pickup Code: <strong>{pickupCode(o)}</strong></div>
                  </td>
                  {!isStaff && user?.role !== 'customer' && <td style={td}>{truckLabel(o)}</td>}
                  {user?.role === 'customer' && <td style={td}>{truckLabel(o)}</td>}
                  <td style={td}>{displayStatus(o.status)}</td>
                  <td style={td}>{formatCurrency(o.total || 0)}</td>
                  {user?.role === 'customer' ? (
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Link to={`/trucks/${tid}`} style={{ textDecoration: 'none' }}>
                          <button type="button">View Truck</button>
                        </Link>
                        {o.status === 'PLACED' && (
                          <button type="button" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleCancelOrder(o)}>Cancel</button>
                        )}
                      </div>
                      <PickupPlanner order={o} coords={coords(o)} defaultPrep={prepDefault(o)} />
                    </td>
                  ) : (
                    <>
                      <td style={td}>
                        <button onClick={() => toggleExpand(o._id)}>{isExpanded ? 'Hide' : 'View'}</button>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => advanceStatus(o)} disabled={!getNextStatus(o.status)}>Next</button>
                          {!['COMPLETED', 'CANCELLED'].includes(normalizeOrderStatus(o.status)) && (
                            <button style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleCancelOrder(o)}>Cancel</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} style={{ padding: 10, background: '#f9fafb' }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>Items:</strong>
                        <ul style={{ margin: '5px 0' }}>
                          {o.items?.map((it, idx) => <li key={idx}>{it.name} x {it.quantity}</li>)}
                        </ul>
                        {o.notes && <div><strong>Notes:</strong> {o.notes}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign: 'left', padding: 6, background: '#f5f5f5', border: '1px solid #ddd' };
const td = { padding: 6, border: '1px solid #ddd', fontSize: 14 };
