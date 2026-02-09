import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

export default function MapEmbed({ lat, lng, zoom = 15, height = 180, rounded = true, showOpenInMaps = true }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const openUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=${encodeURIComponent(zoom)}/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: rounded ? 8 : 0, overflow: 'hidden' }}>
        <MapContainer
          center={[lat, lng]}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ width: '100%', height }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lng]} />
        </MapContainer>
      </div>
      {showOpenInMaps && (
        <a href={openUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, opacity: 0.8, display: 'inline-block', marginTop: 4 }}>
          Open in OpenStreetMap
        </a>
      )}
    </div>
  );
}
