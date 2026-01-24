import React from 'react';

export default function MapEmbed({ lat, lng, zoom = 15, height = 180, rounded = true, showOpenInMaps = true }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&z=${encodeURIComponent(zoom)}&output=embed`;
  const openUrl = `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: rounded ? 8 : 0, overflow: 'hidden' }}>
        <iframe
          title={`map-${lat}-${lng}`}
          src={src}
          width="100%"
          height={height}
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      {showOpenInMaps && (
        <a href={openUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, opacity: 0.8, display: 'inline-block', marginTop: 4 }}>
          Open in Google Maps
        </a>
      )}
    </div>
  );
}
