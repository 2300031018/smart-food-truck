import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../realtime/socket';

function parseHHMM(value) {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone
  }).formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getPlannedLocation(routePlan, now = new Date()) {
  if (!routePlan || !Array.isArray(routePlan.stops) || routePlan.stops.length < 2) return null;
  const tz = routePlan.timezone || 'Asia/Kolkata';
  const nowMin = minutesInTimeZone(now, tz);
  const startMin = parseHHMM(routePlan.dailyStart || '09:00');
  const endMin = parseHHMM(routePlan.dailyEnd || '11:00');
  if (nowMin === null || startMin === null || endMin === null) return routePlan.stops[0];
  if (nowMin < startMin || nowMin > endMin) return routePlan.stops[0];

  const speedKmh = 20;
  const segments = [];
  for (let i = 0; i < routePlan.stops.length - 1; i += 1) {
    const a = routePlan.stops[i];
    const b = routePlan.stops[i + 1];
    const stayMin = Math.max(1, Number(a.stayMin || 15));
    segments.push({ type: 'stay', stop: a, duration: stayMin });
    const distanceKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const travelMin = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
    segments.push({ type: 'travel', from: a, to: b, duration: travelMin });
  }

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  if (totalDuration <= 0) return routePlan.stops[0];
  const windowMin = Math.max(1, endMin - startMin);
  let elapsed = (nowMin - startMin) % windowMin;
  elapsed = elapsed % totalDuration;

  for (const seg of segments) {
    if (elapsed <= seg.duration) {
      if (seg.type === 'stay') return seg.stop;
      const t = seg.duration === 0 ? 0 : (elapsed / seg.duration);
      return {
        lat: seg.from.lat + (seg.to.lat - seg.from.lat) * t,
        lng: seg.from.lng + (seg.to.lng - seg.from.lng) * t
      };
    }
    elapsed -= seg.duration;
  }
  return routePlan.stops[0];
}

function getDisplayLocation(truck) {
  const live = truck?.liveLocation;
  if (typeof live?.lat === 'number' && typeof live?.lng === 'number') {
    return { lat: live.lat, lng: live.lng };
  }
  const planned = getPlannedLocation(truck?.routePlan);
  if (planned && typeof planned.lat === 'number' && typeof planned.lng === 'number') {
    return { lat: planned.lat, lng: planned.lng };
  }
  const base = truck?.location;
  if (typeof base?.lat === 'number' && typeof base?.lng === 'number') {
    return { lat: base.lat, lng: base.lng };
  }
  return null;
}

const defaultRoutePlan = {
  timezone: 'Asia/Kolkata',
  dailyStart: '09:00',
  dailyEnd: '11:00',
  stops: [
    { name: 'Kanuru', lat: 16.4825, lng: 80.6994, stayMin: 20 },
    { name: 'Benz Circle', lat: 16.4995, lng: 80.6466, stayMin: 20 },
    { name: 'McDonalds Gurunanak Colony', lat: 16.5078, lng: 80.6485, stayMin: 20 },
    { name: 'Autonagar', lat: 16.5135, lng: 80.6826, stayMin: 20 },
    { name: 'Kanuru', lat: 16.4825, lng: 80.6994, stayMin: 20 }
  ]
};

export default function Trucks() {
  const { token, user } = useAuth();
  const location = useLocation();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTruck, setNewTruck] = useState({ name:'', description:'', managerId:'' });
  const [updating, setUpdating] = useState(null);
  const [managers, setManagers] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [routeDefaultsBusy, setRouteDefaultsBusy] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const stopMarkersRef = useRef([]);
  const selectedRouteRef = useRef(null);
  const allRoutesRef = useRef([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getTrucks();
        if (res.success && mounted) setTrucks(res.data);
        if (token && user?.role === 'admin') {
          try {
            const mgrRes = await api.getManagers(token);
            if (mgrRes.success && mounted) setManagers(mgrRes.data);
          } catch {}
        }
      } catch (err){ if (mounted) setError(err.message); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [token, user]);

  useEffect(() => {
    if (!trucks.length) return;
    const params = new URLSearchParams(location.search || '');
    const preselectId = params.get('truck');
    if (!preselectId) return;
    const match = trucks.find(t => String(t.id || t._id) === String(preselectId));
    if (match) setSelectedTruck(match);
  }, [location.search, trucks]);

  useEffect(() => {
    if (!selectedTruck) return;
    const currentId = selectedTruck.id || selectedTruck._id;
    const updated = trucks.find(t => (t.id || t._id) === currentId);
    if (updated && updated !== selectedTruck) setSelectedTruck(updated);
  }, [trucks, selectedTruck]);

  // Initialize Leaflet
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    try {
      if (mapRef.current._leaflet_id) {
        delete mapRef.current._leaflet_id;
      }
      const map = L.map(mapRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapInstanceRef.current = map;
      map.whenReady(() => {
        setMapLoaded(true);
        setMapError(null);
        map.invalidateSize();
      });
    } catch (err) {
      setMapError(err?.message || 'Map failed to initialize.');
      setMapLoaded(true);
      return undefined;
    }

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapLoaded || !map) return;
    const nextIds = new Set();
    const bounds = L.latLngBounds([]);

    (trucks || []).forEach(t => {
      const pos = getDisplayLocation(t);
      if (!pos) return;
      const id = String(t.id || t._id);
      nextIds.add(id);

      let marker = markersRef.current[id];
      if (!marker) {
        const el = createMarkerEl(t.status);
        const icon = L.divIcon({
          className: '',
          html: el.outerHTML,
          iconSize: [18, 18],
          iconAnchor: [9, 18]
        });
        marker = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
        marker.on('click', () => setSelectedTruck(t));
        markersRef.current[id] = marker;
      } else {
        marker.setLatLng([pos.lat, pos.lng]);
        const markerEl = marker.getElement()?.firstChild || marker.getElement();
        updateMarkerEl(markerEl, t.status);
      }

      bounds.extend([pos.lat, pos.lng]);
    });

    Object.keys(markersRef.current).forEach(id => {
      if (!nextIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    if (nextIds.size) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [mapLoaded, trucks]);

  // Routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapLoaded || !map) return;

    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];
    if (selectedRouteRef.current) {
      selectedRouteRef.current.remove();
      selectedRouteRef.current = null;
    }
    allRoutesRef.current.forEach(line => line.remove());
    allRoutesRef.current = [];

    if (selectedTruck?.routePlan?.stops?.length >= 2) {
      const coords = selectedTruck.routePlan.stops.map(s => [s.lat, s.lng]);
      const line = L.polyline(coords, { color: '#2563eb', opacity: 0.85, weight: 4 }).addTo(map);
      selectedRouteRef.current = line;

      selectedTruck.routePlan.stops.forEach((s, idx) => {
        const el = createStopMarkerEl(idx + 1);
        const icon = L.divIcon({
          className: '',
          html: el.outerHTML,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        const marker = L.marker([s.lat, s.lng], { icon, interactive: false }).addTo(map);
        stopMarkersRef.current.push(marker);
      });

      map.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 15 });
      return;
    }

    const lines = [];
    (trucks || []).forEach(t => {
      const stops = t?.routePlan?.stops;
      if (!Array.isArray(stops) || stops.length < 2) return;
      const coords = stops.map(s => [s.lat, s.lng]);
      const line = L.polyline(coords, { color: '#94a3b8', opacity: 0.5, weight: 3 }).addTo(map);
      lines.push(line);
    });

    allRoutesRef.current = lines;
    if (lines.length) {
      const bounds = lines.reduce((b, line) => b.extend(line.getBounds()), L.latLngBounds());
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
    }
  }, [mapLoaded, selectedTruck, trucks]);

  // Realtime: subscribe to each truck room for location updates
  useEffect(() => {
    const sock = getSocket(token);
    const rooms = new Set();
    (trucks || []).forEach(t => rooms.add(`truck:${t.id || t._id}`));
    rooms.forEach(room => sock.emit('subscribe', { room }));
    
    const onLoc = ({ truckId, liveLocation }) => {
      setTrucks(list => list.map(t => (t.id === truckId || t._id === truckId) ? { ...t, liveLocation } : t));
      // Update marker position
      const marker = markersRef.current[String(truckId)];
      if (marker) marker.setLatLng([liveLocation.lat, liveLocation.lng]);
    };
    sock.on('truck:location', onLoc);
    return () => {
      try { rooms.forEach(room => sock.emit('unsubscribe', { room })); sock.off('truck:location', onLoc); } catch {}
    };
  }, [token, trucks.map(t => t.id || t._id).join(',')]);

  useEffect(() => {
    if (!mapLoaded) return undefined;
    const interval = setInterval(() => {
      trucks.forEach(t => {
        const id = t.id || t._id;
        const marker = markersRef.current[id];
        if (!marker) return;
        const pos = getDisplayLocation(t);
        if (pos) marker.setLatLng([pos.lat, pos.lng]);
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [mapLoaded, trucks]);

  if (loading) return <p style={{ padding: 20 }}>Loading trucks...</p>;
  if (error) return <p style={{ color: 'red', padding: 20 }}>{error}</p>;

  async function submitTruck(e){
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const payload = { name: newTruck.name, description: newTruck.description };
      if (user.role === 'admin' && newTruck.managerId) payload.managerId = newTruck.managerId;
      const res = await api.createTruck(token, payload);
      if (res.success){
        setTrucks(t => [...t, res.data]);
        setNewTruck({ name:'', description:'', managerId:'' });
      }
    } catch (e){ setError(e.message); } finally { setCreating(false); }
  }

  async function handleAssignManager(truck, managerId){
    if (!managerId) return;
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.assignManager(token, truck.id || truck._id, managerId);
      if (res.success){
        setTrucks(ts => ts.map(t => ( (t.id||t._id) === (truck.id||truck._id) ? { ...t, manager: res.data.manager } : t )));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  async function handleUnassignManager(truck){
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.unassignManager(token, truck.id || truck._id);
      if (res.success){
        setTrucks(ts => ts.map(t => ( (t.id||t._id) === (truck.id||truck._id) ? { ...t, manager: null } : t )));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  async function handleUpdateStatus(truck, status){
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.updateTruckStatusLocation(token, truck.id || truck._id, { status });
      if (res.success){
        setTrucks(ts => ts.map(t => ( (t.id||t._id) === (truck.id||truck._id) ? { ...t, status: res.data.status } : t )));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  async function handleDeleteTruck(truck){
    if (!token || user.role !== 'admin') return;
    if (!window.confirm(`Delete truck "${truck.name}"? This will remove its menu items and unassign its staff.`)) return;
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.deleteTruck(token, truck.id || truck._id);
      if (res.success){
        setTrucks(ts => ts.filter(t => (t.id||t._id) !== (truck.id||truck._id)));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  function handleRoutePlanUpdated(truckId, routePlan) {
    setTrucks(ts => ts.map(t => ((t.id || t._id) === truckId ? { ...t, routePlan } : t)));
    if (selectedTruck && (selectedTruck.id || selectedTruck._id) === truckId) {
      setSelectedTruck({ ...selectedTruck, routePlan });
    }
  }

  async function applyDefaultRoutePlans() {
    if (!token || user?.role !== 'admin') return;
    setRouteDefaultsBusy(true);
    setError(null);
    try {
      await api.applyDefaultRoutePlanDefaults(token);
      const res = await api.getTrucks();
      if (res.success) setTrucks(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRouteDefaultsBusy(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>Food Trucks</h2>
      {token && ['admin','manager'].includes(user.role) && (
        <form onSubmit={submitTruck} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <input placeholder="Name" value={newTruck.name} onChange={e=> setNewTruck(nt => ({ ...nt, name:e.target.value }))} required />
          <input placeholder="Description" value={newTruck.description} onChange={e=> setNewTruck(nt => ({ ...nt, description:e.target.value }))} />
          {user.role === 'admin' && (
            <select value={newTruck.managerId} onChange={e=> setNewTruck(nt => ({ ...nt, managerId:e.target.value }))} required>
              <option value=''>Select Manager</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
            </select>
          )}
          <button disabled={creating}>{creating ? 'Creating...' : 'Create Truck'}</button>
        </form>
      )}

      {/* Map View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 16, height: 'calc(100vh - 200px)', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <div ref={mapRef} style={{ background: '#f0f0f0', borderRadius: 8, border: '1px solid #ddd', width: '100%', height: '100%', minHeight: 420 }}></div>
          {!mapLoaded && !mapError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', background: 'rgba(255,255,255,0.7)', color: '#475569', fontSize: 13, borderRadius: 8 }}>
              Loading map...
            </div>
          )}
          {mapError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', background: 'rgba(255,255,255,0.8)', color: '#b91c1c', fontSize: 13, borderRadius: 8 }}>
              {mapError}
            </div>
          )}
        </div>
        
        {/* Truck Details Sidebar */}
        <div style={{ overflowY: 'auto', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
          {selectedTruck ? (
            <TruckDetailCard 
              truck={selectedTruck} 
              token={token} 
              user={user}
              defaultRoutePlan={defaultRoutePlan}
              onRoutePlanUpdated={handleRoutePlanUpdated}
              onClose={() => setSelectedTruck(null)}
              managers={managers}
              updating={updating}
              setUpdating={setUpdating}
              handleAssignManager={handleAssignManager}
              handleUnassignManager={handleUnassignManager}
              handleUpdateStatus={handleUpdateStatus}
              handleDeleteTruck={handleDeleteTruck}
            />
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
              <p>Click on a truck marker to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Control Panel */}
      {token && user.role === 'admin' && (
        <div style={{ marginTop: 20 }}>
          <h3>Admin Panel</h3>
          <div style={{ marginBottom: 12 }}>
            <button onClick={applyDefaultRoutePlans} disabled={routeDefaultsBusy}>
              {routeDefaultsBusy ? 'Applying Default Route...' : 'Apply Default Route to All Trucks'}
            </button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Manager</th>
                  <th style={th}>Staff Count</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.id || t._id} style={{ borderTop:'1px solid #eee' }}>
                    <td style={td}>{t.name}</td>
                    <td style={td}>{t.status}</td>
                    <td style={td}>{t.manager ? t.manager.email || t.manager.name : <em style={{ opacity:.6 }}>Unassigned</em>}</td>
                    <td style={td}>{t.staffCount ?? '—'}</td>
                    <td style={td}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {!t.manager && managers.length>0 && (
                          <select onChange={e=> handleAssignManager(t, e.target.value)} defaultValue=''>
                            <option value='' disabled>Assign mgr</option>
                            {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        )}
                        {t.manager && <button onClick={()=>handleUnassignManager(t)} disabled={updating===t.id}>Unassign</button>}
                        <button onClick={()=>handleUpdateStatus(t,'active')} disabled={updating===t.id || t.status==='active'}>Active</button>
                        <button onClick={()=>handleUpdateStatus(t,'offline')} disabled={updating===t.id || t.status==='offline'}>Offline</button>
                        <button onClick={()=>handleDeleteTruck(t)} disabled={updating===t.id} style={{ background:'#b91c1c', color:'#fff' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TruckDetailCard({ truck, token, user, defaultRoutePlan, onRoutePlanUpdated, onClose, managers, updating, setUpdating, handleAssignManager, handleUnassignManager, handleUpdateStatus, handleDeleteTruck }) {
  const [activeTab, setActiveTab] = useState('info'); // info, menu, order, reserve
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [currentTruckId, setCurrentTruckId] = useState(truck.id || truck._id);
  const [routePlanDraft, setRoutePlanDraft] = useState('');
  const [routePlanSaving, setRoutePlanSaving] = useState(false);
  const [routePlanError, setRoutePlanError] = useState(null);
  const [routePlanSuccess, setRoutePlanSuccess] = useState(false);

  const pos = getDisplayLocation(truck);
  const lat = typeof pos?.lat === 'number' ? pos.lat : null;
  const lng = typeof pos?.lng === 'number' ? pos.lng : null;

  // Reset state when truck changes
  useEffect(() => {
    const newTruckId = truck.id || truck._id;
    if (newTruckId !== currentTruckId) {
      setCurrentTruckId(newTruckId);
      setActiveTab('info');
      setMenu([]);
      setCart([]);
      setNotes('');
      setSuccess(false);
      setError(null);
      setRoutePlanDraft(JSON.stringify(truck.routePlan || defaultRoutePlan, null, 2));
      setRoutePlanError(null);
      setRoutePlanSuccess(false);
    }
  }, [truck.id, truck._id, currentTruckId]);

  useEffect(() => {
    if (!routePlanDraft) {
      setRoutePlanDraft(JSON.stringify(truck.routePlan || defaultRoutePlan, null, 2));
    }
  }, [routePlanDraft, truck.routePlan, defaultRoutePlan]);

  // Load menu when switching to menu or order tab
  useEffect(() => {
    if ((activeTab === 'menu' || activeTab === 'order') && menu.length === 0) {
      api.getMenuItems(truck.id || truck._id).then(r => { if (r.success) setMenu(r.data); });
    }
  }, [activeTab, truck.id, truck._id, menu.length]);

  function addToCart(item) {
    setCart(c => {
      const existing = c.find(ci => ci.menuItem === item._id);
      if (existing) {
        return c.map(ci => ci.menuItem === item._id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...c, { menuItem: item._id, name: item.name, quantity: 1, unitPrice: item.price }];
    });
  }

  function updateQty(item, qty) {
    const itemId = typeof item === 'string' ? item : item._id;
    if (qty <= 0) {
      setCart(c => c.filter(ci => ci.menuItem !== itemId));
      return;
    }
    setCart(c => {
      const existing = c.find(ci => ci.menuItem === itemId);
      if (existing) {
        return c.map(ci => ci.menuItem === itemId ? { ...ci, quantity: qty } : ci);
      }
      if (typeof item !== 'string') {
        return [...c, { menuItem: itemId, name: item.name, quantity: qty, unitPrice: item.price }];
      }
      return c;
    });
  }

  async function saveRoutePlan() {
    if (!token || user?.role !== 'admin') return;
    setRoutePlanSaving(true);
    setRoutePlanError(null);
    setRoutePlanSuccess(false);
    try {
      const parsed = JSON.parse(routePlanDraft);
      const res = await api.updateTruckRoutePlan(token, truck.id || truck._id, parsed);
      if (res.success) {
        onRoutePlanUpdated(truck.id || truck._id, parsed);
        setRoutePlanSuccess(true);
        setTimeout(() => setRoutePlanSuccess(false), 2000);
      }
    } catch (e) {
      setRoutePlanError(e.message || 'Invalid route plan JSON');
    } finally {
      setRoutePlanSaving(false);
    }
  }

  function applyDefaultRoutePlan() {
    setRoutePlanDraft(JSON.stringify(defaultRoutePlan, null, 2));
    setRoutePlanError(null);
    setRoutePlanSuccess(false);
  }

  async function submitOrder(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = { truck: truck.id || truck._id, items: cart.map(c => ({ menuItem: c.menuItem, quantity: c.quantity })), notes };
      const res = await api.createOrder(token, payload);
      if (res.success) {
        setSuccess(true);
        setCart([]);
        setNotes('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{truck.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ background: truck.status === 'active' ? '#d1fae5' : '#fee2e2', color: truck.status === 'active' ? '#065f46' : '#991b1b', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
              {truck.status}
            </span>
          </div>
          {truck.description && (
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#555' }}>{truck.description}</p>
          )}
          {lat && lng && (
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666' }}>
              📍 {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #eee', marginBottom: 12 }}>
          <button onClick={() => setActiveTab('info')} style={{ flex: 1, padding: '8px 12px', background: activeTab === 'info' ? '#2563eb' : '#f5f5f5', color: activeTab === 'info' ? '#fff' : '#333', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12 }}>
            Info
          </button>
          {token && user?.role === 'customer' && (
            <>
              <button onClick={() => setActiveTab('menu')} style={{ flex: 1, padding: '8px 12px', background: activeTab === 'menu' ? '#2563eb' : '#f5f5f5', color: activeTab === 'menu' ? '#fff' : '#333', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12 }}>
                Menu
              </button>
              <button onClick={() => setActiveTab('order')} style={{ flex: 1, padding: '8px 12px', background: activeTab === 'order' ? '#16a34a' : '#f5f5f5', color: activeTab === 'order' ? '#fff' : '#333', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12 }}>
                Order {cart.length > 0 && `(${cart.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'info' && (
          <div>
            {token && user?.role === 'customer' && (
              <div style={{ marginBottom: 12 }}>
                <Link to={`/reservations/new?truck=${truck.id || truck._id}`} style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', padding: '8px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    📅 Book This Truck
                  </button>
                </Link>
              </div>
            )}

            {truck.routePlan && Array.isArray(truck.routePlan.stops) && truck.routePlan.stops.length > 0 && (
              <div style={{ marginBottom: 12, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f8fafc' }}>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>
                  Route schedule: <strong>{truck.routePlan.dailyStart || '09:00'}-{truck.routePlan.dailyEnd || '11:00'}</strong> ({truck.routePlan.timezone || 'Asia/Kolkata'})
                </div>
                <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: 12, color: '#475569' }}>
                  {truck.routePlan.stops.map((s, idx) => (
                    <li key={`${s.name}-${idx}`} style={{ marginBottom: 2 }}>
                      {s.name} · {s.stayMin || 15} min
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {token && user?.role === 'admin' && (
              <div style={{ marginBottom: 12, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>Edit Route Plan (JSON)</div>
                <textarea
                  value={routePlanDraft}
                  onChange={e => setRoutePlanDraft(e.target.value)}
                  style={{ width: '100%', minHeight: 140, fontSize: 11, padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button type="button" onClick={applyDefaultRoutePlan} style={{ fontSize: 11 }}>
                    Load Default Route
                  </button>
                  <button type="button" onClick={saveRoutePlan} disabled={routePlanSaving} style={{ fontSize: 11 }}>
                    {routePlanSaving ? 'Saving...' : 'Save Route Plan'}
                  </button>
                </div>
                {routePlanSuccess && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#065f46' }}>Route plan saved.</div>
                )}
                {routePlanError && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#b91c1c' }}>{routePlanError}</div>
                )}
              </div>
            )}

            {token && user?.role === 'admin' && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Manager: {truck.manager ? truck.manager.email || truck.manager.name : 'Unassigned'}</label>
                  {!truck.manager && managers.length > 0 && (
                    <select onChange={e => handleAssignManager(truck, e.target.value)} defaultValue='' style={{ width: '100%', padding: 4 }}>
                      <option value='' disabled>Assign manager</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                    </select>
                  )}
                  {truck.manager && (
                    <button onClick={() => handleUnassignManager(truck)} disabled={updating === truck.id} style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}>
                      Unassign Manager
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => handleUpdateStatus(truck, 'active')} disabled={updating === truck.id || truck.status === 'active'} style={{ flex: 1, fontSize: 12 }}>Active</button>
                  <button onClick={() => handleUpdateStatus(truck, 'offline')} disabled={updating === truck.id || truck.status === 'offline'} style={{ flex: 1, fontSize: 12 }}>Offline</button>
                  <button onClick={() => handleDeleteTruck(truck)} disabled={updating === truck.id} style={{ background: '#b91c1c', color: '#fff', flex: 1, fontSize: 12 }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            {cart.length > 0 && token && user?.role === 'customer' && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', borderRadius: 4, border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 12, marginBottom: 8, color: '#1e40af' }}>
                  <strong>🛒 Cart: {cart.length} item(s)</strong> · Total: <strong>₹{cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}</strong>
                </div>
                <button onClick={() => setActiveTab('order')} style={{ width: '100%', padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                  View Cart & Checkout →
                </button>
              </div>
            )}
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Menu Items</h4>
            {menu.length === 0 ? (
              <p style={{ fontSize: 12, color: '#666' }}>No menu items available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menu.map(item => {
                  const inCart = cart.find(c => c.menuItem === item._id);
                  const isSoldOut = item.availability === 'sold-out';
                  return (
                    <div key={item._id} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6, background: inCart ? '#f0f9ff' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 2 }}>{item.name}</div>
                          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 'bold' }}>₹{item.price.toFixed(2)}</div>
                        </div>
                        {token && user?.role === 'customer' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => updateQty(item, (inCart?.quantity || 0) - 1)}
                              disabled={!inCart}
                              style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: inCart ? 'pointer' : 'not-allowed', opacity: inCart ? 1 : 0.5 }}
                            >
                              -
                            </button>
                            <div style={{ minWidth: 20, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
                              {inCart?.quantity || 0}
                            </div>
                            <button
                              type="button"
                              onClick={() => updateQty(item, (inCart?.quantity || 0) + 1)}
                              disabled={isSoldOut}
                              style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #2563eb', background: isSoldOut ? '#cbd5e1' : '#2563eb', color: '#fff', cursor: isSoldOut ? 'not-allowed' : 'pointer', opacity: isSoldOut ? 0.6 : 1 }}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                        {isSoldOut && (
                          <span style={{ color: '#b91c1c', fontWeight: 'bold', background: '#fee2e2', padding: '2px 6px', borderRadius: 3 }}>SOLD OUT</span>
                        )}
                        {inCart && (
                          <span style={{ color: '#2563eb', fontWeight: 'bold', background: '#dbeafe', padding: '2px 6px', borderRadius: 3 }}>✓ In cart ({inCart.quantity})</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'order' && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Your Order</h4>
            {cart.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 12 }}>
                <p>Your cart is empty</p>
                <button onClick={() => setActiveTab('menu')} style={{ padding: '6px 12px', fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  Browse Menu
                </button>
              </div>
            ) : (
              <form onSubmit={submitOrder}>
                <div style={{ marginBottom: 12 }}>
                  {cart.map(item => (
                    <div key={item.menuItem} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: 8, background: '#f9fafb', borderRadius: 4 }}>
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>₹{item.unitPrice.toFixed(2)} each</div>
                      </div>
                      <input type="number" min={0} value={item.quantity} onChange={e => updateQty(item.menuItem, Number(e.target.value))} style={{ width: 50, padding: 4, fontSize: 12 }} />
                      <div style={{ fontSize: 12, fontWeight: 'bold', minWidth: 60, textAlign: 'right' }}>
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
                    <span>Total:</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <textarea placeholder="Special instructions (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: 8, fontSize: 12, minHeight: 60, borderRadius: 4, border: '1px solid #ddd' }} />
                </div>

                <button type="submit" disabled={submitting || cart.length === 0} style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
                  {submitting ? 'Placing Order...' : `Place Order (₹${total.toFixed(2)})`}
                </button>

                {success && (
                  <div style={{ marginTop: 8, padding: 8, background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 12 }}>
                    ✓ Order placed successfully!
                  </div>
                )}
                {error && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fee2e2', color: '#b91c1c', borderRadius: 4, fontSize: 12 }}>
                    {error}
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getMarkerColor(status) {
  if (status === 'active') return '#16a34a';
  if (status === 'en_route') return '#2563eb';
  if (status === 'maintenance') return '#f59e0b';
  if (status === 'inactive' || status === 'offline') return '#ef4444';
  return '#64748b';
}

function createMarkerEl(status) {
  const el = document.createElement('div');
  el.style.width = '18px';
  el.style.height = '18px';
  el.style.borderRadius = '999px';
  el.style.background = getMarkerColor(status);
  el.style.border = '2px solid #ffffff';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
  el.dataset.status = status || '';
  return el;
}

function updateMarkerEl(el, status) {
  if (!el) return;
  const next = status || '';
  if (el.dataset.status === next) return;
  el.dataset.status = next;
  el.style.background = getMarkerColor(status);
}

function createStopMarkerEl(label) {
  const el = document.createElement('div');
  el.style.width = '20px';
  el.style.height = '20px';
  el.style.borderRadius = '999px';
  el.style.background = '#2563eb';
  el.style.color = '#ffffff';
  el.style.fontSize = '10px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.border = '2px solid #ffffff';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
  el.textContent = String(label || '');
  return el;
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', fontSize:12 };
const td = { padding:6, fontSize:13 };
