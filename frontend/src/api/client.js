// Simple API client wrapper
const isProd = import.meta.env.PROD;
const target = import.meta.env.VITE_API_TARGET || '';
export const API_BASE = isProd ? (target.endsWith('/api') ? target : `${target}/api`) : '/api';

function getHeaders(token, isJson = true) {
  const headers = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path, { method = 'GET', body, token, isJson = true } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: getHeaders(token, isJson),
    body: body && isJson ? JSON.stringify(body) : body
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    let message = 'Request failed';
    if (data) {
      if (typeof data === 'string') message = data;
      else if (data.error) {
        if (typeof data.error === 'string') message = data.error; else if (data.error.message) message = data.error.message;
      } else if (data.message) message = data.message;
    }
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('API error', { path, status: res.status, data });
    }
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  // Trucks
  getTrucks: () => request('/trucks'),
  getTruck: (id) => request(`/trucks/${id}`),
  createTruck: (token, payload) => request('/trucks', { method: 'POST', body: payload, token }),
  updateTruck: (token, id, payload) => request(`/trucks/${id}`, { method: 'PUT', body: payload, token }),
  deactivateTruck: (token, id) => request(`/trucks/${id}/deactivate`, { method: 'PATCH', token }),
  reactivateTruck: (token, id) => request(`/trucks/${id}/reactivate`, { method: 'PATCH', token }),
  getManagedTrucks: (token) => request('/trucks/managed', { token }),
  assignManager: (token, id, managerId) => request(`/trucks/${id}/assign-manager`, { method: 'PATCH', body: { managerId }, token }),
  unassignManager: (token, id) => request(`/trucks/${id}/unassign-manager`, { method: 'PATCH', token }),
  getTruckStaff: (token, id) => request(`/trucks/${id}/staff`, { token }),
  assignStaff: (token, id, userId) => request(`/trucks/${id}/staff`, { method: 'POST', body: { userId }, token }),
  unassignStaff: (token, id, userId) => request(`/trucks/${id}/staff/${userId}`, { method: 'DELETE', token }),
  updateTruckStatusLocation: (token, id, payload) => request(`/trucks/${id}/status-location`, { method: 'PATCH', body: payload, token }),
  updateTruckRoutePlan: (token, id, routePlan) => request(`/trucks/${id}/route-plan`, { method: 'PATCH', body: { routePlan }, token }),
  applyDefaultRoutePlanDefaults: (token) => request('/trucks/route-plan-defaults', { method: 'PATCH', token }),
  startTruckRoute: (token, id) => request(`/trucks/${id}/start-route`, { method: 'POST', token }),
  advanceTruckRoute: (token, id) => request(`/trucks/${id}/advance-route`, { method: 'POST', token }),
  stopTruckRoute: (token, id) => request(`/trucks/${id}/stop-route`, { method: 'POST', token }),
  deleteTruck: (token, id) => request(`/trucks/${id}`, { method: 'DELETE', token }),
  getRecommendations: (truckId, currentItems = []) => {
    const qs = currentItems.length > 0 ? `?items=${currentItems.join(',')}` : '';
    return request(`/recommendations/truck/${truckId}${qs}`);
  },

  getMenuItems: (truckId, { group } = {}) => {
    const qs = group ? `?group=${encodeURIComponent(group)}` : '';
    return request(`/menu/truck/${truckId}${qs}`);
  },
  addMenuItem: (token, truckId, payload) => request(`/menu/truck/${truckId}`, { method: 'POST', body: payload, token }),
  updateMenuItem: (token, id, payload) => request(`/menu/${id}`, { method: 'PUT', body: payload, token }),
  deleteMenuItem: (token, id) => request(`/menu/${id}`, { method: 'DELETE', token }),
  toggleMenuAvailability: (token, id) => request(`/menu/${id}/toggle`, { method: 'PATCH', token }),
  updateMenuStock: (token, id, payload) => request(`/menu/${id}/stock`, { method: 'PATCH', body: payload, token }),

  createOrder: (token, payload) => request('/orders', { method: 'POST', body: payload, token }),
  getOrders: (token) => request('/orders', { token }),
  getOrder: (token, id) => request(`/orders/${id}`, { token }),
  updateOrderStatus: (token, id, status) => request(`/orders/${id}/status`, { method: 'PATCH', body: { status }, token }),

  // User creation (hierarchical)
  createManager: (token, payload) => request('/users/managers', { method: 'POST', body: payload, token }),
  getManagers: (token, { includeInactive = false } = {}) => request(`/users/managers${includeInactive ? '?includeInactive=true' : ''}`, { token }),
  getManagersOverview: (token) => request('/users/managers/overview', { token }),
  deleteManager: (token, id) => request(`/users/managers/${id}`, { method: 'DELETE', token }),
  reactivateManager: (token, id) => request(`/users/managers/${id}/reactivate`, { method: 'PATCH', token }),
  createStaff: (token, payload) => request('/users/staff', { method: 'POST', body: payload, token }),

  // Staff Admin
  listStaff: (token) => request('/users/staff', { token }),
  updateStaff: (token, id, payload) => request(`/users/staff/${id}`, { method: 'PUT', body: payload, token }),
  deactivateStaff: (token, id) => request(`/users/staff/${id}/deactivate`, { method: 'PATCH', token }),
  reactivateStaff: (token, id) => request(`/users/staff/${id}/reactivate`, { method: 'PATCH', token }),
  assignStaffToTruck: (token, id, truckId) => request(`/users/staff/${id}/assign`, { method: 'PATCH', body: { truckId }, token }),
  unassignStaffFromTruck: (token, id) => request(`/users/staff/${id}/unassign`, { method: 'PATCH', token })
};

// Manager-specific helpers (limited scope)
export const managerApi = {
  // Managers can list their staff via the same endpoint (server filters scope)
  listStaff: (token) => request('/users/staff', { token }),
  // Move/assign staff by targeting a truck the manager owns
  assignStaffToManagedTruck: (token, truckId, userId) => request(`/trucks/${truckId}/staff`, { method: 'POST', body: { userId }, token }),
  unassignStaffFromManagedTruck: (token, truckId, userId) => request(`/trucks/${truckId}/staff/${userId}`, { method: 'DELETE', token }),
  // Limited staff update (name, staffRole only)
  updateStaffLimited: (token, id, payload) => request(`/users/staff/${id}/manager-update`, { method: 'PATCH', body: payload, token }),
  getManagedTrucks: (token) => request('/trucks/managed', { token }),
  reclaimUnassigned: (token) => request('/users/staff/reclaim', { token }),
  getForecast: (token, truckId) => request(`/forecast/truck/${truckId}`, { token })
};
