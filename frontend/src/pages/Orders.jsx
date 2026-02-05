import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { chatApi } from '../api/chat';
import ChatDrawer from '../components/ChatDrawer';
import MapEmbed from '../components/MapEmbed';
import { getSocket } from '../realtime/socket';
import { useLiveEta } from '../hooks/useLiveEta';

// Helpers for simple ETA estimation without external APIs
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTravelMinutes(distanceKm, mode) {
  // Rough city averages
  const speeds = { walking: 4.5, driving: 25, cycling: 12 };// km/h
  const speed = speeds[mode] || speeds.driving;
  const hours = distanceKm / speed;
  return Math.max(1, Math.round(hours * 60));
}

function PickupPlanner({ order, coords, defaultPrep = 20 }){
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('driving');
  const [prepMin, setPrepMin] = useState(defaultPrep);
  const [myPos, setMyPos] = useState(null);
  const [etaMin, setEtaMin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) || null;

  // Live ETA using Google Distance Matrix when key + my location + coords exist
  const live = useLiveEta({
    origin: myPos,
    destination: coords,
    mode: mode.toUpperCase(),
    apiKey
  });

  // Fallback ETA when API key not present or live ETA errored
  useEffect(() => {
    if (!myPos || !coords) { setEtaMin(null); return; }
    // Prefer live ETA when ok
    if (apiKey && live.status === 'ok' && typeof live.minutes === 'number') {
      setEtaMin(live.minutes);
      return;
    }
    // Fallback rough estimate
    const d = haversineKm(myPos.lat, myPos.lng, coords.lat, coords.lng);
    setEtaMin(estimateTravelMinutes(d, mode));
  }, [myPos, coords?.lat, coords?.lng, mode, live.status, live.minutes, apiKey]);

  function useMyLocation(){
    setErr(null); setBusy(true);
    if (!('geolocation' in navigator)) { setErr('Geolocation not supported'); setBusy(false); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setBusy(false);
    }, e => { setErr(e.message || 'Failed to get location'); setBusy(false); }, { enableHighAccuracy:true, timeout:10000, maximumAge:10000 });
  }

  const suggestion = (() => {
    if (!etaMin) return null;
    // If order is already ready, advise to start now
    if (order.status === 'ready') return 'Order is ready — start now to pick up.';
    const diff = prepMin - etaMin;
    if (diff > 0) return `Leave in ~${diff} min to arrive when it’s ready.`;
    if (diff === 0) return 'Start now to arrive when it’s ready.';
    return `Start now (you’ll reach ~${Math.abs(diff)} min before it’s ready).`;
  })();

  const mapsUrl = (() => {
    if (!myPos || !coords) return null;
    return `https://www.google.com/maps/dir/${encodeURIComponent(myPos.lat + ',' + myPos.lng)}/${encodeURIComponent(coords.lat + ',' + coords.lng)}`;
  })();

  if (!coords) return null;
  return (
    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <strong style={{ fontSize: 13 }}>Plan Pickup</strong>
        <button type="button" onClick={()=> setOpen(o=>!o)}>{open ? 'Hide' : 'Plan'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 8, display:'grid', gap:8 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ fontSize:12 }}>Mode
              <select value={mode} onChange={e=> setMode(e.target.value)} style={{ marginLeft:6 }}>
                <option value="driving">Driving</option>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
              </select>
            </label>
            <label style={{ fontSize:12 }}>Prep (min)
              <input type="number" min={1} max={180} value={prepMin} onChange={e=> setPrepMin(Number(e.target.value)||defaultPrep)} style={{ width:70, marginLeft:6 }} />
            </label>
            <button type="button" onClick={useMyLocation} disabled={busy}>{busy ? 'Locating…' : (myPos ? 'Update my location' : 'Use my location')}</button>
          </div>
          <div style={{ fontSize:13, color:'#111', display:'flex', gap:6, alignItems:'baseline', flexWrap:'wrap' }}>
            {etaMin ? (
              <>
                <span>
                  ETA to truck: <strong>{etaMin} min</strong>
                  {apiKey && live.status === 'ok' && <span style={{ marginLeft:6, fontSize:11, color:'#059669' }}>(live)</span>}
                  {apiKey && live.status === 'loading' && <span style={{ marginLeft:6, fontSize:11, color:'#6b7280' }}>(checking live)</span>}
                  {apiKey && live.status === 'error' && <span style={{ marginLeft:6, fontSize:11, color:'#b45309' }}>(fallback)</span>}
                </span>
                {suggestion && <span>· {suggestion}</span>}
              </>
            ) : (
              <span style={{ opacity:.7 }}>Get ETA by using your location.</span>
            )}
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize:12 }}>Open route in Google Maps</a>
          )}
          {err && <div style={{ color:'#b91c1c', fontSize:12 }}>{err}</div>}
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOrder, setChatOrder] = useState(null);
  const [truckNames, setTruckNames] = useState({}); // id -> name
  const [trucksById, setTrucksById] = useState({}); // id -> truck object
  const [expandedOrders, setExpandedOrders] = useState(new Set()); // expanded order IDs
  const prevStatusRef = useRef({}); // orderId -> status
  const notifiedRef = useRef(new Set()); // orderIds already notified for 'ready'
  const pollTimerRef = useRef(null);

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
        
        // Filter orders if staff is assigned to a specific truck
        if (user?.role === 'staff' && user?.assignedTruck) {
          const assignedTruckId = user.assignedTruck;
          filteredOrders = filteredOrders.filter(o => {
            const tid = typeof o.truck === 'object' ? (o.truck.id || o.truck._id) : o.truck;
            return tid === assignedTruckId;
          });
        }
        
        if (ordersRes.success) setOrders(filteredOrders);
        if (ordersRes.success) {
          const map = {};
          filteredOrders.forEach(o => { map[o._id] = o.status; });
          prevStatusRef.current = map;
        }
        const nameMap = {};
        const byId = {};
        if (trucksRes.success) {
          (trucksRes.data || []).forEach(t => { const key = t.id || t._id; nameMap[key] = t.name; byId[key] = t; });
        }
        // Ensure we have truck details for any truck referenced by orders but missing from list
        if (ordersRes.success) {
          const missingIds = new Set();
          for (const o of filteredOrders) {
            const tid = typeof o.truck==='object' ? (o.truck.id||o.truck._id) : o.truck;
            if (tid && !byId[tid]) missingIds.add(tid);
          }
          if (missingIds.size) {
            const fetched = await Promise.all(Array.from(missingIds).map(id => api.getTruck(id).catch(()=>null)));
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

  // Request browser notification permission once for customers
  useEffect(() => {
    if (user?.role !== 'customer') return;
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch {}
      }
    }
  }, [user]);

  // Removed polling; websocket updates drive status changes and we still fetch initial data above

  // Realtime: subscribe to relevant rooms for current orders (must be before any early returns)
  useEffect(() => {
    if (!token || !orders.length) return;
    const sock = getSocket(token);
    const orderRooms = new Set();
    const truckRooms = new Set();
    orders.forEach(o => {
      orderRooms.add(`order:${o._id}`);
      const tid = getTruckId(o);
      if (tid) truckRooms.add(`truck:${tid}`);
    });
    orderRooms.forEach(room => sock.emit('subscribe', { room }));
    truckRooms.forEach(room => sock.emit('subscribe', { room }));

    const onOrder = ({ orderId, status }) => {
      setOrders(list => list.map(o => o._id === orderId ? { ...o, status } : o));
      // For customers, trigger browser notification when a specific order becomes ready
      if (user?.role === 'customer') {
        const prev = prevStatusRef.current[orderId];
        if (status === 'ready' && prev !== 'ready' && prev !== 'delivered' && prev !== 'cancelled' && !notifiedRef.current.has(orderId)) {
          const o = orders.find(x => x._id === orderId) || { _id: orderId };
          notifyReady({ ...o, status });
          notifiedRef.current.add(orderId);
        }
        // update prev state map
        prevStatusRef.current[orderId] = status;
      }
    };
    const onTruckLoc = ({ truckId, liveLocation }) => {
      setTrucksById(map => ({ ...map, [truckId]: { ...(map[truckId] || {}), id: truckId, liveLocation } }));
    };
    sock.on('order:update', onOrder);
    sock.on('truck:location', onTruckLoc);
    return () => {
      try {
        orderRooms.forEach(room => sock.emit('unsubscribe', { room }));
        truckRooms.forEach(room => sock.emit('unsubscribe', { room }));
        sock.off('order:update', onOrder);
        sock.off('truck:location', onTruckLoc);
      } catch {}
    };
  }, [token, orders]);

  function notifyReady(order){
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const title = 'Your order is ready for pickup';
    const body = `${orderCode(order)} at ${truckLabel(order)}`;
    try {
      const n = new Notification(title, { body, tag: order._id });
      n.onclick = () => {
        window.focus();
        const truckId = typeof order.truck==='object' ? (order.truck.id||order.truck._id) : order.truck;
        if (truckId) window.open(`/trucks/${truckId}`, '_blank');
        n.close();
      };
    } catch {}
  }

  function getNextStatus(current) {
    // Normalize legacy labels to backend targets
    const legacy = { accepted: 'preparing', completed: 'delivered' };
    if (legacy[current]) return legacy[current];
    const flow = ['pending','preparing','ready','delivered'];
    const idx = flow.indexOf(current);
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

  function openChat(order){
    setChatOrder(order);
    setChatOpen(true);
  }

  function toggleExpand(orderId){
    const newSet = new Set(expandedOrders);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setExpandedOrders(newSet);
  }

  function shortId(id){ return typeof id === 'string' ? id.slice(-6) : ''; }
  function orderCode(o){ const sid = shortId(o._id||''); return sid ? `ORD-${sid.toUpperCase()}` : 'ORD-—'; }
  function pickupCode(o){ const sid = shortId(o._id||''); return sid ? sid.toUpperCase() : '—'; }
  function getTruckId(o){ return typeof o.truck==='object' ? (o.truck.id||o.truck._id) : o.truck; }
  function getTruckObj(o){ const id = getTruckId(o); return (typeof o.truck==='object' ? o.truck : trucksById[id]) || null; }
  function truckLabel(o){
    if (o.truck && typeof o.truck === 'object') return o.truck.name || shortId(o.truck.id || o.truck._id || '');
    if (typeof o.truck === 'string') return truckNames[o.truck] || shortId(o.truck);
    return '—';
  }
  function directionsUrl(o){
    const t = getTruckObj(o);
    const live = t?.liveLocation; const base = t?.location;
    const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
    const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
    if (lat !== null && lng !== null) {
      return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
    }
    return null;
  }
  function coords(o){
    const t = getTruckObj(o);
    const live = t?.liveLocation; const base = t?.location;
    const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
    const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
    return (lat !== null && lng !== null) ? { lat, lng } : null;
  }

  function prepDefault(o){
    const candidates = [o.estimatedPrepMinutes, o.prepMinutes, o.prepTimeMin, o.prepTime];
    for (const c of candidates) { if (typeof c === 'number' && c > 0) return c; }
    return 20; // fallback
  }

  function displayStatus(status){
    if (user?.role !== 'customer') return status;
    const map = {
      pending: 'received',
      preparing: 'preparing',
      ready: 'ready for pickup',
      delivered: 'picked up',
      cancelled: 'cancelled'
    };
    return map[status] || status;
  }

  if (loading) return <p style={{ padding: 20 }}>Loading orders...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Orders ({orders.length})</h2>
      {user?.role === 'customer' && (
        <div style={{ background:'#f8fafc', border:'1px solid #e5e7eb', padding:'8px 10px', borderRadius:6, margin:'8px 0 12px' }}>
          Pickup only: collect your order from the truck. Status “picked up” means it’s been handed over at the truck.
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
            ) : user?.role === 'staff' ? (
              <>
                <th style={th}>Status</th>
                <th style={th}>Total</th>
                <th style={th}>Details</th>
                <th style={th}>Action</th>
              </>
            ) : (
              <>
                <th style={th}>Truck</th>
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
            return (
              <React.Fragment key={o._id}>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={td}>
                    <div><span title={o._id}>{orderCode(o)}</span></div>
                    <div style={{ fontSize:11, opacity:.7 }}>Pickup Code: <strong>{pickupCode(o)}</strong></div>
                  </td>
                  {user?.role === 'customer' && (
                    <td style={td}>{truckLabel(o)}</td>
                  )}
                  {user?.role === 'staff' ? (
                    <>
                      <td style={td}>{displayStatus(o.status)}</td>
                      <td style={td}>{formatCurrency(o.total || 0)}</td>
                      <td style={td}>
                        <button onClick={() => toggleExpand(o._id)} style={{ marginBottom: isExpanded ? 6 : 0 }}>
                          {isExpanded ? '▼ Hide Details' : '▶ View Details'}
                        </button>
                      </td>
                      <td style={td}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {['manager','staff','admin'].includes(user.role) && (
                            <button onClick={() => advanceStatus(o)} disabled={!getNextStatus(o.status) || ['cancelled','delivered'].includes(o.status)}>Next</button>
                          )}
                          {token && (
                            <button onClick={() => openChat(o)}>Chat</button>
                          )}
                        </div>
                      </td>
                    </>
                  ) : user?.role === 'customer' ? (
                    <>
                      <td style={td}>{displayStatus(o.status)}</td>
                      <td style={td}>{formatCurrency(o.total || 0)}</td>
                      <td style={td}>
                        <div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: 6 }}>
                            <a href={`/trucks/${getTruckId(o)}`} style={{ textDecoration:'none' }}>
                              <button type="button">View Truck</button>
                            </a>
                            {directionsUrl(o) && (
                              <a href={directionsUrl(o)} target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>
                                <button type="button">Directions</button>
                              </a>
                            )}
                            {token && <button onClick={() => openChat(o)}>Chat</button>}
                          </div>
                          {coords(o) && (
                            <MapEmbed lat={coords(o).lat} lng={coords(o).lng} height={160} />
                          )}
                          <PickupPlanner order={o} coords={coords(o)} defaultPrep={prepDefault(o)} />
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={td}>{truckLabel(o)}</td>
                      <td style={td}>{displayStatus(o.status)}</td>
                      <td style={td}>{formatCurrency(o.total || 0)}</td>
                      <td style={td}>
                        <button onClick={() => toggleExpand(o._id)} style={{ marginBottom: isExpanded ? 6 : 0 }}>
                          {isExpanded ? '▼ Hide Details' : '▶ View Details'}
                        </button>
                      </td>
                      <td style={td}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {['manager','staff','admin'].includes(user.role) && (
                            <button onClick={() => advanceStatus(o)} disabled={!getNextStatus(o.status) || ['cancelled','delivered'].includes(o.status)}>Next</button>
                          )}
                          {token && (
                            <button onClick={() => openChat(o)}>Chat</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                {isExpanded && user?.role !== 'customer' && (
                  <tr style={{ borderBottom: '1px solid #ddd', background: '#f9fafb' }}>
                    <td colSpan={user?.role === 'staff' ? 5 : 6} style={{ ...td, paddingTop: 12, paddingBottom: 12 }}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {/* Items section */}
                        <div>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Items Ordered:</h4>
                          {o.items && o.items.length > 0 ? (
                            <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
                              {o.items.map((item, idx) => (
                                <li key={idx} style={{ marginBottom: 4, fontSize: 13 }}>
                                  <strong>{item.name}</strong> x {item.quantity} @ ₹{Number(item.unitPrice).toFixed(2)} = ₹{Number(item.lineTotal).toFixed(2)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>No items</p>
                          )}
                        </div>
                        {/* Notes section */}
                        {o.notes && (
                          <div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Customer Notes:</h4>
                            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 4, padding: 8, fontSize: 13 }}>
                              {o.notes}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        title={chatOrder ? `Order Chat · ${chatOrder._id.slice(-6)}` : 'Order Chat'}
        roomResolver={(tok)=> chatOrder ? chatApi.getOrderRoom(tok, chatOrder._id) : null}
      />
    </div>
  );
}

const th = { textAlign: 'left', padding: 6, background: '#f5f5f5', border: '1px solid #ddd' };
const td = { padding: 6, border: '1px solid #ddd', fontSize: 14 };
