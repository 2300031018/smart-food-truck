import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RouteEditorModal from '../components/RouteEditorModal';
import { clearRoutePathsForTruck } from '../utils/routePathCache';
import { useSocketRooms } from '../hooks/useSocketRooms';
import gsap from 'gsap';

// Configuration
const CITY_ZOOM = 5;
const CITY_CENTER = [20.5937, 78.9629]; // Center of India
const TRUCK_COLORS = ['#ff6b6b', '#4ecdc4', '#f9ca24', '#6c5ce7', '#a29bfe', '#fab1a0'];

// Custom "Neon" Marker using CSS
function createNeonMarkerIcon(color, label) {
  const el = document.createElement('div');
  el.className = 'custom-marker';
  el.style.cssText = `
    width: 30px;
    height: 30px;
    background: ${color};
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 10;
  `;

  const inner = document.createElement('div');
  inner.style.cssText = `
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    transform: rotate(45deg);
  `;
  el.appendChild(inner);

  return L.divIcon({
    className: '',
    html: el.outerHTML,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -35]
  });
}

const DEFAULT_ROUTE_PLAN = {
  name: 'Central Route',
  timezone: 'Asia/Kolkata',
  dailyStart: '09:00',
  dailyEnd: '23:00',
  stops: []
};

// --- Main Component ---
export default function Trucks() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLayersRef = useRef([]);
  const stopsLayersRef = useRef([]);
  const hasZoomedRef = useRef(false);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTruckId, setSelectedTruckId] = useState(null);



  // Fetch Data
  useEffect(() => {
    let mounted = true;
    api.getTrucks()
      .then(res => { if (mounted && res.success) setTrucks(res.data || []); })
      .catch(err => { if (mounted) setError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  // Socket Updates
  const handleTruckUpdate = useCallback(({ truckId, data }) => {
    setTrucks(prev => prev.map(t => (t.id || t._id) === truckId ? { ...t, ...data } : t));
  }, []);

  const handleTruckDeleted = useCallback(({ truckId }) => {
    clearRoutePathsForTruck(truckId);
    setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
  }, []);

  const listeners = useMemo(() => ({ 'truck:update': handleTruckUpdate, 'truck:deleted': handleTruckDeleted }), [handleTruckUpdate, handleTruckDeleted]);
  useSocketRooms({ token, listeners, enabled: Boolean(token) });

  // Init Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Colorful Voyager Tiles
    const map = L.map(mapRef.current, { zoomControl: false }).setView(CITY_CENTER, CITY_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const nextIds = new Set();
    const clusters = {};

    // 1. Cluster Logic
    trucks.forEach(t => {
      let loc = t.liveLocation || t.location || (t.routePlan?.stops?.[0]);
      if (loc && typeof loc.lat === 'number') {
        const key = `${Number(loc.lat).toFixed(4)},${Number(loc.lng).toFixed(4)}`;
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push({ t, loc });
      }
    });

    // 2. Render Markers
    Object.values(clusters).forEach(group => {
      group.forEach(({ t, loc }, i) => {
        const id = t.id || t._id;
        nextIds.add(id);

        // Spread overlapping markers
        let lat = Number(loc.lat);
        let lng = Number(loc.lng);
        if (group.length > 1) {
          const angle = (i / group.length) * 2 * Math.PI;
          const offset = 0.0003;
          lat += Math.sin(angle) * offset;
          lng += Math.cos(angle) * offset;
        }

        const color = TRUCK_COLORS[parseInt(id.slice(-4), 16) % TRUCK_COLORS.length];
        const icon = createNeonMarkerIcon(color);

        let marker = markersRef.current[id];
        if (!marker) {
          marker = L.marker([lat, lng], { icon }).addTo(map);

          // Add Popup with "View Menu" link
          const popupContent = `
            <div style="padding: 5px; min-width: 150px;">
              <h3 style="margin: 0 0 5px 0; font-size: 1.1rem;">${t.name}</h3>
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 0.85rem;">${t.status}</p>
              <button 
                onclick="window.location.href='/trucks/${id}'"
                style="width: 100%; padding: 8px; background: #ff6b6b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;"
              >
                View Menu
              </button>
            </div>
          `;
          marker.bindPopup(popupContent, { closeButton: false, offset: [0, -25] });

          marker.on('click', () => {
            setSelectedTruckId(id);
            map.flyTo([lat, lng], 16, { duration: 1.5 });
          });
          markersRef.current[id] = marker;
        } else {
          marker.setLatLng([lat, lng]);
          marker.setIcon(icon);
        }
      });
    });

    // Auto-fit bounds on first load
    if (trucks.length > 0 && !hasZoomedRef.current) {
      const validLocs = trucks
        .map(t => t.liveLocation || t.location || t.routePlan?.stops?.[0])
        .filter(l => l && typeof l.lat === 'number' && typeof l.lng === 'number')
        .map(l => [l.lat, l.lng]);
      
      if (validLocs.length > 0) {
        const bounds = L.latLngBounds(validLocs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        hasZoomedRef.current = true;
      }
    }

    // 3. Render Selected Truck Route
    const selectedTruck = trucks.find(t => (t.id || t._id) === selectedTruckId);
    if (selectedTruck && selectedTruck.routePlan?.stops?.length >= 2) {
      const stops = selectedTruck.routePlan.stops;

      // Clear previous layers
      routeLayersRef.current.forEach(l => l.remove());
      stopsLayersRef.current.forEach(l => l.remove());
      routeLayersRef.current = [];
      stopsLayersRef.current = [];

      // Add Stops
      stops.forEach((s, idx) => {
        const circle = L.circleMarker([s.lat, s.lng], {
          radius: 6,
          color: 'white',
          fillColor: '#3b82f6',
          fillOpacity: 1,
          weight: 2
        }).addTo(map);

        circle.bindPopup(`
          <div style="min-width: 120px; font-family: sans-serif;">
            <strong style="color: #38bdf8; display: block; margin-bottom: 4px;">${s.name || `Stop ${idx + 1}`}</strong>
            <div style="font-size: 0.8rem; color: #4b5563;">🕒 Stay: <b>${s.waitTime || 15} mins</b></div>
          </div>
        `, { closeButton: false });
        stopsLayersRef.current.push(circle);
      });

      // Fetch and Add Route Lines
      const fetchAndDraw = async () => {
        const paths = [];
        for (let i = 0; i < stops.length - 1; i++) {
          const from = stops[i];
          const to = stops[i + 1];
          const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
          try {
            const res = await fetch(url);
            const data = await res.json();
            const coords = data.routes?.[0]?.geometry?.coordinates;
            if (coords) {
              const poly = L.polyline(coords.map(([lng, lat]) => [lat, lng]), {
                color: '#38bdf8',
                weight: 3,
                opacity: 0.6,
                dashArray: '5, 10'
              }).addTo(map);
              routeLayersRef.current.push(poly);
            }
          } catch (e) { console.warn('Road path fetch failed', e); }
        }
      };
      fetchAndDraw();
    } else {
      routeLayersRef.current.forEach(l => l.remove());
      stopsLayersRef.current.forEach(l => l.remove());
      routeLayersRef.current = [];
      stopsLayersRef.current = [];
    }

    // 4. Cleanup
    Object.keys(markersRef.current).forEach(id => {
      if (!nextIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

  }, [trucks, selectedTruckId]);

  return (
    <div style={{ height: 'calc(100vh - var(--nav-height))', display: 'flex', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Left Sidebar: Truck List */}
      <div
        className="glass-panel"
        style={{
          width: '380px',
          height: '100%',
          overflowY: 'auto',
          padding: '32px 24px',
          zIndex: 10,
          borderRight: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 0,
          background: '#fff',
          boxShadow: '10px 0 40px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', fontWeight: 900, color: '#0f172a' }}>
            Find <span className="text-gradient">Trucks</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>
            {loading ? 'Searching...' : `${trucks.length} gourmet trucks nearby`}
          </p>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {trucks.map(truck => (
            <div
              key={truck.id || truck._id}
              onClick={() => {
                setSelectedTruckId(truck.id || truck._id);
                const loc = truck.liveLocation || truck.location || truck.routePlan?.stops?.[0];
                if (loc && mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16);
                }
              }}
              className="truck-card"
              style={{
                background: (selectedTruckId === (truck.id || truck._id)) ? 'rgba(255,107,107,0.05)' : '#fff',
                padding: '24px',
                borderRadius: '20px',
                cursor: 'pointer',
                border: selectedTruckId === (truck.id || truck._id)
                  ? '2px solid var(--primary)'
                  : '1px solid #f1f5f9',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: (selectedTruckId === (truck.id || truck._id)) ? '0 10px 25px rgba(255,107,107,0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => {
                if (selectedTruckId !== (truck.id || truck._id)) {
                  e.currentTarget.style.borderColor = 'rgba(255,107,107,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedTruckId !== (truck.id || truck._id)) {
                  e.currentTarget.style.borderColor = '#f1f5f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>{truck.name}</h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: '30px',
                  background: truck.status === 'SERVING' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.05)',
                  color: truck.status === 'SERVING' ? 'var(--success)' : 'var(--text-secondary)',
                  letterSpacing: '0.5px'
                }}>
                  {truck.status}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6', fontWeight: 500 }}>
                {truck.description || 'Gourmet delicacies on wheels.'}
              </p>

              <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/trucks/${truck.id || truck._id}`);
                  }}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    fontSize: '0.85rem'
                  }}
                >
                  Order Now
                </button>
              </div>
            </div>
          ))}
          {trucks.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🚚</div>
              <p style={{ fontWeight: 600 }}>No active trucks found today.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Check back later or explore other areas.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Content: Huge Map */}
      <div style={{ flex: 1, position: 'relative', background: '#f8fafc' }}>
        <div
          ref={mapRef}
          style={{ width: '100%', height: '100%' }}
        />
        {/* Soft Vignette Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 150px rgba(0,0,0,0.05)',
          zIndex: 5
        }} />
      </div>
    </div>
  );
}
