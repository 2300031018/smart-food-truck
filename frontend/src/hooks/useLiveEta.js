import { useEffect, useState } from 'react';
import { loadGoogleMapsApi } from './useGoogleMapsApi';

export function useLiveEta({ origin, destination, mode = 'DRIVING', apiKey }) {
  const [minutes, setMinutes] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus('loading'); setError(null);
      if (!origin || !destination || !apiKey) { setStatus('error'); setError('Missing origin/destination or API key'); return; }
      try {
        const maps = await loadGoogleMapsApi(apiKey);
        if (cancelled) return;
        const svc = new maps.DistanceMatrixService();
        const req = {
          origins: [new maps.LatLng(origin.lat, origin.lng)],
          destinations: [new maps.LatLng(destination.lat, destination.lng)],
          travelMode: mode,
          drivingOptions: mode === 'DRIVING' ? { departureTime: new Date() } : undefined,
          unitSystem: maps.UnitSystem.METRIC,
        };
        svc.getDistanceMatrix(req, (res, sts) => {
          if (cancelled) return;
          if (sts !== 'OK') {
            setStatus('error'); setError(sts || 'DistanceMatrix error'); return;
          }
          try {
            const el = res.rows?.[0]?.elements?.[0];
            const secs = el?.duration_in_traffic?.value || el?.duration?.value;
            if (typeof secs === 'number') {
              setMinutes(Math.max(1, Math.round(secs / 60)));
              setStatus('ok');
            } else {
              setStatus('error'); setError('No duration');
            }
          } catch (e) {
            setStatus('error'); setError(e.message || 'Parse error');
          }
        });
      } catch (e) {
        if (cancelled) return;
        setStatus('error'); setError(e.message || 'Load error');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, mode, apiKey]);

  return { minutes, status, error };
}
