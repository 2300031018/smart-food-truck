const Truck = require('../models/Truck');
const { emitTruckLocation, emitTruckUpdate } = require('../socket');

const SPEED_KMH = 20;
const DEFAULT_UPDATE_MS = 5000;
const MIN_MOVE_METERS = 2;

function parseHHMM(value) {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesInTimeZone(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone
    }).formatToParts(date);
    const hour = Number(parts.find(p => p.type === 'hour')?.value);
    const minute = Number(parts.find(p => p.type === 'minute')?.value);
    const second = Number(parts.find(p => p.type === 'second')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
    return hour * 60 + minute + (second / 60);
  } catch {
    return null;
  }
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeStops(routePlan) {
  const stops = Array.isArray(routePlan?.stops) ? routePlan.stops : [];
  return stops
    .map(s => ({
      name: String(s?.name || '').trim(),
      lat: Number(s?.lat),
      lng: Number(s?.lng),
      waitTime: Math.max(0, Number.isFinite(Number(s?.waitTime)) ? Number(s.waitTime) : 15)
    }))
    .filter(s => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

function ensureLoopStops(stops) {
  if (stops.length < 2) return stops;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const same = Math.abs(first.lat - last.lat) < 1e-6 && Math.abs(first.lng - last.lng) < 1e-6;
  return same ? stops : [...stops, { ...first, waitTime: Math.max(0, Number.isFinite(Number(first.waitTime)) ? Number(first.waitTime) : 15) }];
}

function computePlannedLocation(routePlan, now = new Date()) {
  const tz = routePlan?.timezone || 'Asia/Kolkata';
  const stops = ensureLoopStops(normalizeStops(routePlan));
  if (stops.length < 2) return null;

  const nowMin = minutesInTimeZone(now, tz);
  const startMin = parseHHMM(routePlan?.dailyStart || '09:00');
  const endMin = parseHHMM(routePlan?.dailyEnd || '11:00');
  if (nowMin === null || startMin === null || endMin === null) {
    return { lat: stops[0].lat, lng: stops[0].lng, status: 'SERVING', currentStopIndex: 0 };
  }

  // If outside daily window, default to first stop
  if (nowMin < startMin || nowMin > endMin) {
    return { lat: stops[0].lat, lng: stops[0].lng, status: 'SERVING', currentStopIndex: 0 };
  }

  const segments = [];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    segments.push({ type: 'stay', stop: a, stopIndex: i, duration: Math.max(0, Number(a.waitTime ?? 15)) });
    const distanceKm = haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000;
    const travelMin = Math.max(0.1, (distanceKm / SPEED_KMH) * 60);
    segments.push({ type: 'travel', from: a, to: b, fromIndex: i, toIndex: i + 1, duration: travelMin });
  }

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  if (totalDuration <= 0) {
    return { lat: stops[0].lat, lng: stops[0].lng, status: 'SERVING', currentStopIndex: 0 };
  }

  const windowMin = Math.max(1, endMin - startMin);
  let elapsed = (nowMin - startMin) % windowMin;
  elapsed = elapsed % totalDuration;

  for (const seg of segments) {
    if (elapsed <= seg.duration) {
      if (seg.type === 'stay') {
        return { lat: seg.stop.lat, lng: seg.stop.lng, status: 'SERVING', currentStopIndex: seg.stopIndex };
      }
      const t = seg.duration === 0 ? 0 : (elapsed / seg.duration);
      return {
        lat: seg.from.lat + (seg.to.lat - seg.from.lat) * t,
        lng: seg.from.lng + (seg.to.lng - seg.from.lng) * t,
        status: 'MOVING',
        currentStopIndex: seg.toIndex
      };
    }
    elapsed -= seg.duration;
  }

  return { lat: stops[0].lat, lng: stops[0].lng, status: 'SERVING', currentStopIndex: 0 };
}

async function updateTruckLocations() {
  const now = new Date();
  const trucks = await Truck.find({
    isActive: true,
    status: { $in: ['SERVING', 'MOVING'] },
    'routePlan.stops.0': { $exists: true }
  }).select('routePlan liveLocation status currentStopIndex');

  for (const truck of trucks) {
    const pos = computePlannedLocation(truck.routePlan, now);
    if (!pos) continue;

    const prev = truck.liveLocation || {};
    const prevLat = prev.lat;
    const prevLng = prev.lng;
    const moved = (Number.isFinite(prevLat) && Number.isFinite(prevLng))
      ? haversineMeters(prevLat, prevLng, pos.lat, pos.lng)
      : Infinity;

    const statusChanged = truck.status !== pos.status;
    const stopChanged = truck.currentStopIndex !== pos.currentStopIndex;
    if (moved < MIN_MOVE_METERS && !statusChanged && !stopChanged) continue;

    truck.liveLocation = { lat: pos.lat, lng: pos.lng, updatedAt: now };
    truck.status = pos.status;
    truck.currentStopIndex = pos.currentStopIndex;
    await truck.save();
    try {
      const updateData = { liveLocation: truck.liveLocation, status: truck.status, currentStopIndex: truck.currentStopIndex };
      emitTruckLocation(truck.id, truck.liveLocation, truck.status, truck.currentStopIndex);
      emitTruckUpdate(truck.id, updateData);
    } catch { }
  }
}

function startTruckAutoUpdate() {
  const intervalMs = Number(process.env.TRUCK_LOCATION_UPDATE_MS) || DEFAULT_UPDATE_MS;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try { await updateTruckLocations(); } catch (e) { console.warn('[AutoRoute] update failed', e?.message || e); }
    finally { running = false; }
  }

  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { startTruckAutoUpdate, computePlannedLocation };
