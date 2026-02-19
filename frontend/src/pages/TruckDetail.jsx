import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from '../utils/currency';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapEmbed from '../components/MapEmbed';
import { useSocketRooms } from '../hooks/useSocketRooms';

export default function TruckDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [truck, setTruck] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState(null);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [locForm, setLocForm] = useState({ lat: '', lng: '' });
  const [recs, setRecs] = useState([]);
  const watchIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.getTruck(id),
      api.getMenuItems(id),
      api.getRecommendations(id)
    ]).then(([truckRes, menuRes, recRes]) => {
      if (mounted) {
        if (truckRes.success) setTruck(truckRes.data);
        if (menuRes.success) setMenu(menuRes.data);
        if (recRes.success) setRecs(recRes.data);
      }
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));

    return () => { mounted = false; };
  }, [id]);
  const rooms = useMemo(() => (id ? [`truck:${id}`] : []), [id]);
  const handleLocation = useCallback((payload) => {
    if (!payload?.truckId) return;
    setTruck(prev => {
      const currentId = prev?.id || prev?._id || id;
      if (payload.truckId !== currentId) return prev;
      return {
        ...(prev || {}),
        liveLocation: payload.liveLocation,
        status: payload.status ?? prev?.status,
        currentStopIndex: Number.isFinite(payload.currentStopIndex) ? payload.currentStopIndex : prev?.currentStopIndex
      };
    });
  }, [id]);
  const listeners = useMemo(() => ({ 'truck:location': handleLocation }), [handleLocation]);
  useSocketRooms({ token, rooms, listeners, enabled: Boolean(token && id) });

  useEffect(() => {
    return () => {
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const lat = truck?.liveLocation?.lat ?? truck?.location?.lat;
    const lng = truck?.liveLocation?.lng ?? truck?.location?.lng;
    setLocForm({ lat: (typeof lat === 'number' ? String(lat) : ''), lng: (typeof lng === 'number' ? String(lng) : '') });
  }, [truck?.liveLocation?.lat, truck?.liveLocation?.lng, truck?.location?.lat, truck?.location?.lng]);

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;
  if (!truck) return <p style={{ padding: 20 }}>Truck not found.</p>;

  const isManagerOfTruck = token && user?.role === 'manager' && truck?.manager && (truck.manager.id === user.id || truck.manager.id === user._id);
  const canManageMenu = token && (user?.role === 'admin' || isManagerOfTruck);
  const canUpdateLocation = token && (user?.role === 'admin' || isManagerOfTruck);

  async function sendLiveLocation(lat, lng) {
    try {
      const res = await api.updateTruckStatusLocation(token, id, { liveLocation: { lat, lng } });
      if (res.success) {
        setTruck(t => ({ ...t, liveLocation: res.data.liveLocation }));
      }
    } catch (e) { setLocError(e.message); }
  }

  function updateOnce() {
    setLocError(null); setLocBusy(true);
    if (!('geolocation' in navigator)) { setLocError('Geolocation not supported'); setLocBusy(false); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      await sendLiveLocation(latitude, longitude);
      setLocBusy(false);
    }, err => { setLocError(err.message || 'Failed to get location'); setLocBusy(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 });
  }

  function toggleAuto() {
    if (!('geolocation' in navigator)) { setLocError('Geolocation not supported'); return; }
    if (autoUpdate) {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null; setAutoUpdate(false);
    } else {
      setLocError(null);
      const idw = navigator.geolocation.watchPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        await sendLiveLocation(latitude, longitude);
      }, err => { setLocError(err.message || 'Location error'); }, { enableHighAccuracy: true, maximumAge: 10000 });
      watchIdRef.current = idw; setAutoUpdate(true);
    }
  }

  async function saveManual() {
    setLocError(null);
    const lat = Number(locForm.lat); const lng = Number(locForm.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setLocError('Enter valid latitude and longitude'); return; }
    setLocBusy(true);
    await sendLiveLocation(lat, lng);
    setLocBusy(false);
  }
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>{truck.name}</h2>
      <MapEmbed
        height={200}
        routePlan={truck.routePlan}
        currentStopIndex={truck.currentStopIndex}
        status={truck.status}
        liveLocation={truck.liveLocation || truck.location}
        truckId={truck.id || truck._id}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0 10px' }}>
        <a href="#menu-section" style={{ textDecoration: 'none' }}>
          <button type="button">View Menu</button>
        </a>
      </div>
      <p>{truck.description}</p>

      {recs.length > 0 && (
        <div style={{ margin: '15px 0', padding: 12, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#5b21b6' }}>
            <span>✨</span> Popular Pairings
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {recs.map((r, i) => (
              <div key={i} style={{ flexShrink: 0, padding: '6px 12px', background: '#fff', border: '1px solid #e9d5ff', borderRadius: 20, fontSize: 13, color: '#6d28d9', fontWeight: 500 }}>
                {r.name}
              </div>
            ))}
          </div>
        </div>
      )}
      {canUpdateLocation && (
        <div style={{ margin: '8px 0 12px', padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Live Location</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {(() => {
              const live = truck?.liveLocation;
              const base = truck?.location;
              const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
              const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
              return (
                <>
                  Current: {lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—'}
                </>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={updateOnce} disabled={locBusy}>{locBusy ? 'Updating…' : 'Update to my location'}</button>
            <button type="button" onClick={toggleAuto}>{autoUpdate ? 'Stop auto-update' : 'Auto-update from my device'}</button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="Latitude" value={locForm.lat} onChange={e => setLocForm(f => ({ ...f, lat: e.target.value }))} style={{ width: 140 }} />
            <input placeholder="Longitude" value={locForm.lng} onChange={e => setLocForm(f => ({ ...f, lng: e.target.value }))} style={{ width: 140 }} />
            <button type="button" onClick={saveManual} disabled={locBusy}>Save location</button>
          </div>
          {locError && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{locError}</div>}
          {truck?.liveLocation && <div style={{ fontSize: 11, opacity: .7, marginTop: 6 }}>Last updated: {truck.liveLocation.updatedAt ? new Date(truck.liveLocation.updatedAt).toLocaleString() : 'now'}</div>}
        </div>
      )}
      <h3 id="menu-section">Menu</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {menu.map(item => (
          <li key={item._id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{item.name} - {formatCurrency(item.price)}{item.category ? ` · ${item.category}` : ''}</span>
            </div>
          </li>
        ))}
      </ul>
      {canManageMenu && (
        <a href={`/trucks/${id}/menu-manage`} style={{ display: 'inline-block', marginTop: 12 }}>Manage Menu</a>
      )}
    </div>
  );
}

const miniBtn = { cursor: 'pointer', border: '1px solid #bbb', background: '#fafafa', fontSize: 12, padding: '3px 6px', lineHeight: 1, borderRadius: 4 };
const chip = { cursor: 'pointer', border: '1px solid #ddd', background: '#f8f8f8', fontSize: 12, padding: '3px 8px', lineHeight: 1.4, borderRadius: 999 };
