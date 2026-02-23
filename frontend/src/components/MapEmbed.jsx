import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildRouteKey, getCachedRoutePaths, cacheRoutePaths, associateTruckWithRoute } from '../utils/routePathCache';

// Fix for missing marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER = [16.5062, 80.6480];

function normalizeTruckStatus(status) {
  const key = String(status || '').trim().toUpperCase();
  const map = {
    OPEN: 'SERVING',
    PREPARING: 'SERVING',
    SOLD_OUT: 'CLOSED',
    ACTIVE: 'SERVING',
    INACTIVE: 'CLOSED',
    OFFLINE: 'CLOSED',
    EN_ROUTE: 'MOVING',
    'EN-ROUTE': 'MOVING',
    MAINTENANCE: 'CLOSED'
  };
  return map[key] || key;
}

function getStopColor(status, currentStopIndex, stopIndex) {
  if (typeof currentStopIndex !== 'number') return '#9ca3af';
  if (stopIndex < currentStopIndex) return '#dc2626';
  if (stopIndex === currentStopIndex && normalizeTruckStatus(status) === 'SERVING') return '#16a34a'; // Green for active serving stop
  return '#3b82f6'; // Blue for future stops
}

function FitBounds({ stops, liveLocation }) {
  const map = useMap();
  useEffect(() => {
    const points = [];
    if (stops && stops.length > 0) {
      stops.forEach(s => points.push([s.lat, s.lng]));
    }
    if (liveLocation && typeof liveLocation.lat === 'number') {
      points.push([liveLocation.lat, liveLocation.lng]);
    }

    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, stops, liveLocation]);
  return null;
}

export default function MapEmbed({ zoom = 12, height = 180, rounded = true, routePlan, currentStopIndex = 0, status, liveLocation, truckId }) {
  const stops = Array.isArray(routePlan?.stops) ? routePlan.stops : [];
  const linePositions = stops.map(s => [s.lat, s.lng]);
  const [roadPaths, setRoadPaths] = useState([]);
  const routeKey = useMemo(() => buildRouteKey(stops), [stops]);

  // Truck Icon custom style if we wanted, but default is fine for now. 
  // Maybe we can use a custom DivIcon later if the user requests it.

  useEffect(() => {
    if (!routeKey) {
      setRoadPaths([]);
      return undefined;
    }

    const cached = getCachedRoutePaths(routeKey);
    if (cached && cached.length > 0) {
      setRoadPaths(cached);
      if (truckId) associateTruckWithRoute(routeKey, truckId);
      return undefined;
    }

    let canceled = false;
    const controller = new AbortController();
    async function fetchPaths() {
      const collected = [];
      for (let i = 0; i < stops.length - 1; i += 1) {
        const from = stops[i];
        const to = stops[i + 1];
        if (!from || !to) continue;
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Failed to fetch route');
          const data = await response.json();
          const coords = data.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length > 0) {
            const path = coords.map(([lng, lat]) => [lat, lng]);
            collected.push(path);
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.warn('Failed to load road path', error);
          }
          break;
        }
      }
      if (!canceled) {
        setRoadPaths(collected);
        cacheRoutePaths(routeKey, collected, truckId);
      }
    }

    setRoadPaths([]);
    fetchPaths();
    return () => {
      canceled = true;
      controller.abort();
    };
  }, [routeKey, stops, truckId]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ border: 'none', borderRadius: rounded ? 12 : 0, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ width: '100%', height }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Route Line */}
          {((roadPaths.length > 0 ? roadPaths : (linePositions.length >= 2 ? [linePositions] : []))).map((positions, idx) => (
            positions.length >= 2 && (
              <Polyline
                key={`route-${idx}`}
                positions={positions}
                pathOptions={{
                  color: '#4ecdc4',
                  weight: 4,
                  opacity: 0.8,
                  dashArray: '10, 10',
                  lineCap: 'round'
                }}
              />
            )
          ))}

          {/* Scheduled Stops */}
          {stops.map((s, idx) => (
            <CircleMarker
              key={`stop-${idx}`}
              center={[s.lat, s.lng]}
              radius={6}
              pathOptions={{
                color: 'white',
                fillColor: getStopColor(status, currentStopIndex, idx),
                fillOpacity: 1,
                weight: 2
              }}
            >
              <Popup>
                <div style={{ minWidth: 140, padding: 4 }}>
                  <strong style={{ color: 'var(--primary)', fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>
                    {s.name || `Stop ${idx + 1}`}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>🕒 Stay Duration:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{s.waitTime || 15} mins</strong>
                  </div>
                  {idx === currentStopIndex && normalizeTruckStatus(status) === 'SERVING' && (
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>
                      ✓ CURRENTLY SERVING HERE
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Actual Live Truck Location */}
          {liveLocation && typeof liveLocation.lat === 'number' && (
            <Marker position={[liveLocation.lat, liveLocation.lng]}>
              <Popup>Current Truck Location</Popup>
            </Marker>
          )}

          <FitBounds stops={stops} liveLocation={liveLocation} />
        </MapContainer>
      </div>
    </div>
  );
}
