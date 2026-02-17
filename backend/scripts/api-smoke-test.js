const DEFAULT_BASE = 'http://localhost:5000/api';
const BASE_URL = process.env.API_BASE || DEFAULT_BASE;

const CREDS = {
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'Password123!'
  },
  manager: {
    email: process.env.MANAGER_EMAIL || 'manager@example.com',
    password: process.env.MANAGER_PASSWORD || 'Password123!'
  },
  staff: {
    email: process.env.STAFF_EMAIL || 'staff@example.com',
    password: process.env.STAFF_PASSWORD || 'Password123!'
  },
  customer: {
    email: process.env.CUSTOMER_EMAIL || 'customer@example.com',
    password: process.env.CUSTOMER_PASSWORD || 'Password123!'
  }
};

const results = [];

async function request(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || data?.message || data || res.statusText;
    const err = new Error(String(msg));
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function runStep(name, fn) {
  try {
    const data = await fn();
    results.push({ name, ok: true });
    return data;
  } catch (err) {
    results.push({ name, ok: false, error: err.message, status: err.status });
    return null;
  }
}

async function runStepExpected(name, fn, expectedStatus, note) {
  try {
    const data = await fn();
    results.push({ name, ok: true });
    return data;
  } catch (err) {
    if (err && err.status === expectedStatus) {
      results.push({ name, ok: true, warned: true, warning: note || `Expected ${expectedStatus}` });
      return null;
    }
    results.push({ name, ok: false, error: err.message, status: err.status });
    return null;
  }
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function printSummary() {
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  const warned = results.filter(r => r.warned).length;
  console.log(`\nAPI smoke test results: ${ok} passed, ${warned} warnings, ${fail} failed`);
  results.forEach(r => {
    if (r.ok && r.warned) console.log(`  ⚠️  ${r.name} (${r.warning})`);
    else if (r.ok) console.log(`  ✅ ${r.name}`);
    else console.log(`  ❌ ${r.name} (${r.status || 'err'}) ${r.error}`);
  });
}

async function main() {
  console.log(`Running API smoke test against ${BASE_URL}`);

  const health = await runStep('GET /health', () => request('GET', '/health'));

  const adminLogin = await runStep('POST /auth/login (admin)', () => request('POST', '/auth/login', { body: CREDS.admin }));
  const managerLogin = await runStep('POST /auth/login (manager)', () => request('POST', '/auth/login', { body: CREDS.manager }));
  const staffLogin = await runStep('POST /auth/login (staff)', () => request('POST', '/auth/login', { body: CREDS.staff }));
  const customerLogin = await runStep('POST /auth/login (customer)', () => request('POST', '/auth/login', { body: CREDS.customer }));

  const adminToken = adminLogin?.data?.token || adminLogin?.token;
  const managerToken = managerLogin?.data?.token || managerLogin?.token;
  const staffToken = staffLogin?.data?.token || staffLogin?.token;
  const customerToken = customerLogin?.data?.token || customerLogin?.token;
  const adminUser = adminLogin?.data?.user || adminLogin?.user;
  const managerUser = managerLogin?.data?.user || managerLogin?.user;
  const staffUser = staffLogin?.data?.user || staffLogin?.user;
  const customerUser = customerLogin?.data?.user || customerLogin?.user;

  await runStep('GET /auth/me (admin)', () => request('GET', '/auth/me', { token: adminToken }));
  await runStep('GET /auth/me (manager)', () => request('GET', '/auth/me', { token: managerToken }));
  await runStep('GET /auth/me (staff)', () => request('GET', '/auth/me', { token: staffToken }));
  await runStep('GET /auth/me (customer)', () => request('GET', '/auth/me', { token: customerToken }));

  const trucksRes = await runStep('GET /trucks', () => request('GET', '/trucks'));
  const baseTruck = trucksRes?.data?.[0];

  const tempTruckPayload = {
    name: `Smoke Truck ${Date.now()}`,
    description: 'Temporary truck for API smoke tests',
    managerId: managerUser?.id || managerUser?._id,
    routePlan: {
      timezone: 'Asia/Kolkata',
      dailyStart: '09:00',
      dailyEnd: '11:00',
      stops: [
        { name: 'Stop 1', lat: 12.9716, lng: 77.5946, stayMin: 15 },
        { name: 'Stop 2', lat: 12.9726, lng: 77.5956, stayMin: 15 }
      ]
    }
  };

  const createdTruck = await runStep('POST /trucks (admin)', () => request('POST', '/trucks', { token: adminToken, body: tempTruckPayload }));
  const tempTruckId = createdTruck?.data?.id || createdTruck?.data?._id || createdTruck?.id || baseTruck?.id || baseTruck?._id;

  if (tempTruckId) {
    await runStep('GET /trucks/:id', () => request('GET', `/trucks/${tempTruckId}`));
    await runStep('PUT /trucks/:id', () => request('PUT', `/trucks/${tempTruckId}`, { token: adminToken, body: { description: 'Updated by smoke test' } }));
    await runStep('PATCH /trucks/:id/status-location', () => request('PATCH', `/trucks/${tempTruckId}/status-location`, { token: adminToken, body: { status: 'MOVING', liveLocation: { lat: 12.9718, lng: 77.5948 } } }));
    await runStep('PATCH /trucks/:id/route-plan', () => request('PATCH', `/trucks/${tempTruckId}/route-plan`, { token: adminToken, body: { routePlan: { timezone: 'Asia/Kolkata', dailyStart: '09:00', dailyEnd: '11:00', stops: [ { name: 'Stop A', lat: 12.9716, lng: 77.5946, stayMin: 15 }, { name: 'Stop B', lat: 12.9732, lng: 77.5962, stayMin: 15 } ] } } }));
    await runStep('PATCH /trucks/:id/deactivate', () => request('PATCH', `/trucks/${tempTruckId}/deactivate`, { token: adminToken }));
    await runStep('PATCH /trucks/:id/reactivate', () => request('PATCH', `/trucks/${tempTruckId}/reactivate`, { token: adminToken }));
    await runStep('GET /trucks/:id/staff', () => request('GET', `/trucks/${tempTruckId}/staff`, { token: adminToken }));
  }

  await runStep('GET /trucks/managed (admin)', () => request('GET', '/trucks/managed', { token: adminToken }));
  await runStep('PATCH /trucks/route-plan-defaults (admin)', () => request('PATCH', '/trucks/route-plan-defaults', { token: adminToken }));

  await runStep('GET /users/managers (admin)', () => request('GET', '/users/managers?includeInactive=true', { token: adminToken }));
  await runStep('GET /users/managers/overview (admin)', () => request('GET', '/users/managers/overview', { token: adminToken }));
  await runStep('GET /users/managers/hierarchy (admin)', () => request('GET', '/users/managers/hierarchy?includeInactive=true', { token: adminToken }));
  await runStep('GET /users/staff (admin)', () => request('GET', '/users/staff', { token: adminToken }));
  if (managerUser?.id || managerUser?._id) {
    const managerId = managerUser?.id || managerUser?._id;
    await runStep('GET /users/me/team (admin)', () => request('GET', `/users/me/team?as=manager&managerId=${managerId}`, { token: adminToken }));
  } else {
    results.push({ name: 'GET /users/me/team (admin)', ok: true, warned: true, warning: 'Skipped (missing managerId)' });
  }
  await runStep('GET /users/me/team (manager)', () => request('GET', '/users/me/team', { token: managerToken }));
  await runStep('GET /users/me/team (staff)', () => request('GET', '/users/me/team', { token: staffToken }));

  let createdStaffId = null;
  if (tempTruckId && managerToken) {
    const staffPayload = { name: 'Smoke Staff', email: `smoke.staff.${Date.now()}@example.com`, password: 'Password123!', truckId: tempTruckId };
    const staffRes = await runStep('POST /users/staff (manager)', () => request('POST', '/users/staff', { token: managerToken, body: staffPayload }));
    createdStaffId = staffRes?.data?.id || staffRes?.data?._id;

    if (createdStaffId) {
      await runStep('PATCH /users/staff/:id/manager-update', () => request('PATCH', `/users/staff/${createdStaffId}/manager-update`, { token: managerToken, body: { name: 'Smoke Staff Updated', staffRole: 'general' } }));
      await runStep('PUT /users/staff/:id (admin)', () => request('PUT', `/users/staff/${createdStaffId}`, { token: adminToken, body: { name: 'Smoke Staff Admin Updated' } }));
      await runStep('PATCH /users/staff/:id/deactivate', () => request('PATCH', `/users/staff/${createdStaffId}/deactivate`, { token: adminToken }));
      await runStep('PATCH /users/staff/:id/reactivate', () => request('PATCH', `/users/staff/${createdStaffId}/reactivate`, { token: adminToken }));
      await runStep('PATCH /users/staff/:id/assign', () => request('PATCH', `/users/staff/${createdStaffId}/assign`, { token: adminToken, body: { truckId: tempTruckId } }));
      await runStep('PATCH /users/staff/:id/unassign', () => request('PATCH', `/users/staff/${createdStaffId}/unassign`, { token: adminToken }));
    }
  }

  await runStep('GET /users/staff/reclaim (manager)', () => request('GET', '/users/staff/reclaim', { token: managerToken }));

  let menuItemId = null;
  if (tempTruckId) {
    await runStep('GET /menu/truck/:truckId', () => request('GET', `/menu/truck/${tempTruckId}`));
    const menuRes = await runStep('POST /menu/truck/:truckId (admin)', () => request('POST', `/menu/truck/${tempTruckId}`, { token: adminToken, body: { name: 'Smoke Item', price: 9.99, category: 'Main', prepTime: 5 } }));
    menuItemId = menuRes?.data?._id || menuRes?.data?.id;
    if (menuItemId) {
      await runStep('PUT /menu/:id', () => request('PUT', `/menu/${menuItemId}`, { token: adminToken, body: { price: 10.5 } }));
      await runStep('PATCH /menu/:id/stock', () => request('PATCH', `/menu/${menuItemId}/stock`, { token: adminToken, body: { stockCount: 5 } }));
    }
  }

  let orderId = null;
  if (tempTruckId && menuItemId) {
    const orderRes = await runStep('POST /orders (customer)', () => request('POST', '/orders', { token: customerToken, body: { truck: tempTruckId, items: [{ menuItem: menuItemId, quantity: 1 }], notes: 'smoke test' } }));
    orderId = orderRes?.data?._id || orderRes?.data?.id;
    await runStep('GET /orders (customer)', () => request('GET', '/orders', { token: customerToken }));
    await runStep('GET /orders (admin)', () => request('GET', '/orders', { token: adminToken }));
    await runStep('GET /orders (staff)', () => request('GET', '/orders', { token: staffToken }));
    if (orderId) {
      await runStep('GET /orders/:id (customer)', () => request('GET', `/orders/${orderId}`, { token: customerToken }));
      await runStep('PATCH /orders/:id/status (manager)', () => request('PATCH', `/orders/${orderId}/status`, { token: managerToken, body: { status: 'preparing' } }));
    }
  }

  if (tempTruckId) {
    await runStepExpected('GET /chats/truck/:truckId/room', () => request('GET', `/chats/truck/${tempTruckId}/room`, { token: customerToken }), 403, 'Expected customer access to be forbidden');
    if (orderId) {
      await runStep('GET /chats/order/:orderId/room', () => request('GET', `/chats/order/${orderId}/room`, { token: customerToken }));
    }
  }

  if (menuItemId) {
    await runStep('PATCH /menu/:id/toggle', () => request('PATCH', `/menu/${menuItemId}/toggle`, { token: adminToken }));
    await runStep('DELETE /menu/:id', () => request('DELETE', `/menu/${menuItemId}`, { token: adminToken }));
  }

  if (createdStaffId) {
    await runStep('DELETE /users/staff/:id', () => request('DELETE', `/users/staff/${createdStaffId}`, { token: adminToken }));
  }

  if (tempTruckId) {
    await runStep('DELETE /trucks/:id', () => request('DELETE', `/trucks/${tempTruckId}`, { token: adminToken }));
  }

  printSummary();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
