const routeEntries = new Map();
const truckToRouteKey = new Map();

export function buildRouteKey(stops = []) {
  if (!Array.isArray(stops) || stops.length < 2) return '';
  return stops.map(s => `${Number(s.lat || 0).toFixed(6)}:${Number(s.lng || 0).toFixed(6)}`).join('|');
}

export function getCachedRoutePaths(key) {
  if (!key) return null;
  const record = routeEntries.get(key);
  return record ? record.paths : null;
}

function ensureEntry(key) {
  if (!routeEntries.has(key)) {
    routeEntries.set(key, { paths: [], trucks: new Set() });
  }
  return routeEntries.get(key);
}

export function cacheRoutePaths(key, paths = [], truckId) {
  if (!key) return;
  const record = ensureEntry(key);
  record.paths = Array.isArray(paths) ? paths : [];
  if (truckId) {
    record.trucks.add(truckId);
    truckToRouteKey.set(truckId, key);
  }
}

export function associateTruckWithRoute(key, truckId) {
  if (!key || !truckId) return;
  const record = ensureEntry(key);
  record.trucks.add(truckId);
  truckToRouteKey.set(truckId, key);
}

export function clearRoutePathsForTruck(truckId) {
  if (!truckId) return;
  const key = truckToRouteKey.get(truckId);
  if (!key) return;
  const record = routeEntries.get(key);
  if (record) {
    record.trucks.delete(truckId);
    if (record.trucks.size === 0) {
      routeEntries.delete(key);
    }
  }
  truckToRouteKey.delete(truckId);
}
