import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RouteEditorModal from '../components/RouteEditorModal';
import { clearRoutePathsForTruck } from '../utils/routePathCache';
import { useSocketRooms } from '../hooks/useSocketRooms';

const CITY_ZOOM = 13;
const CITY_CENTER = [16.5062, 80.6480];

const ROUTE_STOPS = [
  { name: 'Benz Circle', lat: 16.4957, lng: 80.6542 },
  { name: 'Siddhartha College', lat: 16.5047, lng: 80.6478 },
  { name: 'Governorpet', lat: 16.5183, lng: 80.6315 },
  { name: 'Bhavani Island', lat: 16.5233, lng: 80.6016 }
];

const DEFAULT_ROUTE_PLAN = {
  name: 'Central Vijayawada Route',
  timezone: 'Asia/Kolkata',
  dailyStart: '09:00',
  dailyEnd: '11:00',
  stops: ROUTE_STOPS.map(s => ({ ...s, waitTime: 120 }))
};

const TRUCK_COLORS = ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#0f766e', '#db2777'];

function createTruckIcon(color, label) {
  const el = document.createElement('div');
  el.style.width = '20px';
  el.style.height = '20px';
  el.style.borderRadius = '999px';
  el.style.background = color;
  el.style.color = '#fff';
  el.style.fontSize = '10px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.border = '2px solid #ffffff';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
  el.textContent = String(label || '');
  return L.divIcon({ className: '', html: el.outerHTML, iconSize: [20, 20], iconAnchor: [10, 10] });
}

export default function Trucks() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [creating, setCreating] = useState(false);
  const [newTruck, setNewTruck] = useState({ name: '', description: '', managerId: '' });
  const [managers, setManagers] = useState([]);
  const [editingTruck, setEditingTruck] = useState(null);
  const [justCreatedId, setJustCreatedId] = useState(null);
  const justCreatedIdRef = useRef(null);

  const orderedTrucks = useMemo(() => {
    return [...trucks].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [trucks]);

  useEffect(() => {
    let mounted = true;
    api.getTrucks()
      .then(res => { if (mounted && res.success) setTrucks(res.data || []); })
      .catch(err => { if (mounted) setError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  const handleTruckUpdate = useCallback(({ truckId, data }) => {
    setTrucks(prev => prev.map(t => {
      if ((t.id || t._id) === truckId) {
        return { ...t, ...data };
      }
      return t;
    }));
  }, []);

  const handleTruckDeleted = useCallback(({ truckId }) => {
    clearRoutePathsForTruck(truckId);
    setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
  }, []);

  const listeners = useMemo(() => ({
    'truck:update': handleTruckUpdate,
    'truck:deleted': handleTruckDeleted
  }), [handleTruckUpdate, handleTruckDeleted]);
  useSocketRooms({ token, listeners, enabled: Boolean(token) });

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    let mounted = true;
    api.getManagers(token)
      .then(res => { if (mounted && res.success) setManagers(res.data || []); })
      .catch(() => { });
    return () => { mounted = false; };
  }, [token, user?.role]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (mapRef.current._leaflet_id) {
      mapRef.current._leaflet_id = null;
    }
    const map = L.map(mapRef.current, { zoomControl: true }).setView(CITY_CENTER, CITY_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Removed polyline as it's not relevant for multiple independent trucks with different routes
    // L.polyline(coords, { color: '#94a3b8', weight: 3, opacity: 0.7 }).addTo(map);

    mapInstanceRef.current = map;
    return () => {
      map.off();
      map.remove();
      mapInstanceRef.current = null;
      if (mapRef.current && mapRef.current._leaflet_id) {
        mapRef.current._leaflet_id = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const nextIds = new Set();

    // Group trucks by location to handle overlap
    const clusters = {};
    orderedTrucks.forEach(t => {
      let loc = t.liveLocation || t.location || t.currentLocation;

      // Fallback to first stop if no location data
      if ((!loc || typeof loc.lat !== 'number') && t.routePlan && Array.isArray(t.routePlan.stops) && t.routePlan.stops.length > 0) {
        loc = t.routePlan.stops[0];
      }

      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const lat = Number(loc.lat);
        const lng = Number(loc.lng);
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push({ t, loc: { ...loc, lat, lng } });
      } else {
        // Truck has no valid location or route stops
        console.warn('Truck missing location:', t.name);
      }
    });

    Object.values(clusters).forEach(group => {
      const count = group.length;
      group.forEach((item, i) => {
        const { t, loc } = item;
        const id = String(t.id || t._id);
        nextIds.add(id);

        let finalLat = loc.lat;
        let finalLng = loc.lng;

        // Apply circular offset if overlap
        if (count > 1) {
          const angle = (i / count) * 2 * Math.PI;
          const offset = 0.0003; // approx 30m
          finalLat += Math.sin(angle) * offset;
          finalLng += Math.cos(angle) * offset;
        }

        const color = TRUCK_COLORS[parseInt(id.slice(-4), 16) % TRUCK_COLORS.length || 0];
        let marker = markersRef.current[id];
        const icon = createTruckIcon(color, t.name.slice(0, 2).toUpperCase());

        if (!marker) {
          marker = L.marker([finalLat, finalLng], { icon }).addTo(map);
          marker.on('click', () => navigate(`/trucks/${t.id || t._id}`));
          markersRef.current[id] = marker;
        } else {
          marker.setLatLng([finalLat, finalLng]);
          marker.setIcon(icon);
        }
      });
    });

    Object.keys(markersRef.current).forEach(id => {
      if (!nextIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [orderedTrucks, navigate]);



  async function handleCreateTruck(e) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const payload = {
        name: newTruck.name,
        description: newTruck.description,
        status: 'SERVING',
        currentStopIndex: 0,
        routePlan: DEFAULT_ROUTE_PLAN
      };
      if (user?.role === 'admin' && newTruck.managerId) payload.managerId = newTruck.managerId;
      const res = await api.createTruck(token, payload);
      if (res.success) {
        setTrucks(list => [...list, res.data]);
        setNewTruck({ name: '', description: '', managerId: '' });
        // Prompt for route creation immediately
        setEditingTruck(res.data);
        const newId = res.data.id || res.data._id;
        setJustCreatedId(newId);
        justCreatedIdRef.current = newId;
      }
    } catch (err) {
      setError(err.message || 'Failed to create truck');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>Food Trucks</h2>
      {loading && <p style={{ padding: '6px 0', color: '#475569' }}>Loading trucks...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {token && ['admin', 'manager'].includes(user?.role) && (
        <form onSubmit={handleCreateTruck} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            placeholder="Truck name"
            value={newTruck.name}
            onChange={(e) => setNewTruck(t => ({ ...t, name: e.target.value }))}
            required
          />
          <input
            placeholder="Description"
            value={newTruck.description}
            onChange={(e) => setNewTruck(t => ({ ...t, description: e.target.value }))}
          />
          {user?.role === 'admin' && (
            <select
              value={newTruck.managerId}
              onChange={(e) => setNewTruck(t => ({ ...t, managerId: e.target.value }))}
              required
            >
              <option value="">Select Manager</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.email}</option>
              ))}
            </select>
          )}
          <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Truck'}</button>
        </form>
      )}

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: 420,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#f0f0f0'
        }}
      />
      {editingTruck && (
        <RouteEditorModal
          truck={editingTruck}
          token={token}
          onClose={() => {
            // Rollback if this was a fresh creation and user cancelled (and not saved)
            const tId = editingTruck.id || editingTruck._id;
            // Check the ref, not the state, to get the latest value synchronously
            if (justCreatedIdRef.current === tId) {
              // If the ref still holds the ID, it means it wasn't cleared by onSave
              api.deleteTruck(token, tId).catch(console.error);
              setTrucks(prev => prev.filter(t => (t.id || t._id) !== tId));
            }
            setEditingTruck(null);
            setJustCreatedId(null);
            justCreatedIdRef.current = null;
          }}
          onSave={() => {
            // Confirmed, so clear the ref so onClose doesn't delete it
            justCreatedIdRef.current = null;
            setJustCreatedId(null);
            // Refresh list to show updated route
            api.getTrucks().then(res => { if (res.success) setTrucks(res.data || []); });
          }}
        />
      )}
    </div>
  );
}