import { useEffect, useState } from 'react';

export function useLiveEta({ origin, destination, mode = 'DRIVING', apiKey }) {
  const [minutes, setMinutes] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus('loading'); setError(null);
      if (!origin || !destination) { setStatus('error'); setError('Missing origin/destination'); return; }
      try {
        const toRad = (v) => (v * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(destination.lat - origin.lat);
        const dLon = toRad(destination.lng - origin.lng);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;
        const speedMap = { DRIVING: 25, WALKING: 4.5, CYCLING: 12 };
        const speed = speedMap[String(mode || '').toUpperCase()] || speedMap.DRIVING;
        const minutesEst = Math.max(1, Math.round((distanceKm / speed) * 60));
        if (cancelled) return;
        setMinutes(minutesEst);
        setStatus('ok');
      } catch (e) {
        if (cancelled) return;
        setStatus('error'); setError(e.message || 'Estimate error');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, mode, apiKey]);

  return { minutes, status, error };
}
