const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { emitTruckLocation } = require('../socket');
const MenuItem = require('../models/MenuItem');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { cacheGet, cacheSet, cacheDelByPrefix } = require('../utils/cache');

function getDefaultRoutePlan() {
  return {
    timezone: 'Asia/Kolkata',
    dailyStart: '09:00',
    dailyEnd: '11:00',
    stops: [
      { name: 'Kanuru', lat: 16.4825, lng: 80.6994, stayMin: 20 },
      { name: 'Benz Circle', lat: 16.4995, lng: 80.6466, stayMin: 20 },
      { name: 'McDonalds Gurunanak Colony', lat: 16.5078, lng: 80.6485, stayMin: 20 },
      { name: 'Autonagar', lat: 16.5135, lng: 80.6826, stayMin: 20 },
      { name: 'Kanuru', lat: 16.4825, lng: 80.6994, stayMin: 20 }
    ]
  };
}

function ensureRoutePlan(routePlan) {
  if (!routePlan) return getDefaultRoutePlan();
  if (!Array.isArray(routePlan.stops) || routePlan.stops.length < 2) return getDefaultRoutePlan();
  return routePlan;
}

// PATCH /api/trucks/route-plan-defaults (admin only)
exports.applyDefaultRoutePlanDefaults = asyncHandler(async (req, res) => {
  const filter = {
    $or: [
      { routePlan: { $exists: false } },
      { 'routePlan.stops.0': { $exists: false } }
    ]
  };
  const update = { routePlan: getDefaultRoutePlan() };
  const result = await Truck.updateMany(filter, update);
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success: true, data: { matched: result.matchedCount || result.n, modified: result.modifiedCount || result.nModified } });
});

// Create Truck (manager/admin)
// Admin may pass managerId to assign ownership; manager always becomes owner automatically.
exports.createTruck = asyncHandler(async (req, res) => {
  const { managerId, ...rest } = req.body || {};
  let managerToSet = req.user.id; // default: creator
  if (req.user.role === 'admin' && managerId) {
    // Validate target manager
    const User = require('../models/User');
    const mgr = await User.findById(managerId);
    if (!mgr || mgr.role !== 'manager') {
      return res.status(400).json({ success:false, error:{ message:'managerId must reference an existing manager user' } });
    }
    managerToSet = mgr._id;
  }
  const routePlan = rest.routePlan || getDefaultRoutePlan();
  let truck = await Truck.create({ ...rest, routePlan, manager: managerToSet });
  truck = await Truck.findById(truck._id).populate('manager', 'id email name role');
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.status(201).json({ success: true, data: truck });
});
// Get all active trucks (include staffCount)
exports.getTrucks = asyncHandler(async (req, res) => {
  const cacheKey = 'trucks:all';
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });
  const trucks = await Truck.find({ isActive: true }).populate('manager', 'id email name role').populate('staff', 'id');
  const data = trucks.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    cuisineType: t.cuisineType,
    status: t.status,
    location: t.location || null,
    liveLocation: t.liveLocation || null,
    routePlan: ensureRoutePlan(t.routePlan),
    manager: t.manager ? { id: t.manager.id, email: t.manager.email, name: t.manager.name } : null,
    staffCount: (t.staff || []).length
  }));
  await cacheSet(cacheKey, data, 30);
  res.json({ success: true, data });
});

// Get single truck (include staffCount)
exports.getTruck = asyncHandler(async (req, res) => {
  const cacheKey = `trucks:${req.params.id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role').populate('staff', 'id');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  const data = {
    id: truck.id,
    name: truck.name,
    description: truck.description,
    cuisineType: truck.cuisineType,
    status: truck.status,
    location: truck.location || null,
    liveLocation: truck.liveLocation || null,
    routePlan: ensureRoutePlan(truck.routePlan),
    manager: truck.manager ? { id: truck.manager.id, email: truck.manager.email, name: truck.manager.name } : null,
    staffCount: (truck.staff || []).length
  };
  await cacheSet(cacheKey, data, 30);
  res.json({ success: true, data });
});

// Get trucks managed by current manager (or all for admin)
exports.getManagedTrucks = asyncHandler(async (req, res) => {
  if (req.user.role === 'manager') {
  const trucks = await Truck.find({ manager: req.user.id }).populate('manager', 'id email name role');
    return res.json({ success: true, data: trucks });
  }
  if (req.user.role === 'admin') {
  const trucks = await Truck.find({}).populate('manager', 'id email name role');
    return res.json({ success: true, data: trucks });
  }
  return res.status(403).json({ success:false, error:{ message: 'Forbidden' }});
});

// Update truck (manager/admin)
// Admin can reassign manager using managerId; managers cannot change ownership.
exports.updateTruck = asyncHandler(async (req, res) => {
  const { managerId, ...rest } = req.body || {};
  const update = { ...rest };
  if (managerId) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success:false, error:{ message:'Only admin can reassign manager' } });
    }
    const User = require('../models/User');
    const mgr = await User.findById(managerId);
    if (!mgr || mgr.role !== 'manager') {
      return res.status(400).json({ success:false, error:{ message:'managerId must reference an existing manager user' } });
    }
    update.manager = mgr._id;
  }
  const truck = await Truck.findByIdAndUpdate(req.params.id, update, { new: true }).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success: true, data: truck });
});

// Soft deactivate
exports.deactivateTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, { isActive: false, status: 'inactive' }, { new: true });
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success: true, data: truck });
});

// Reactivate truck (admin/manager)
exports.reactivateTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, { isActive: true, status: 'active' }, { new: true });
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success: true, data: truck });
});

// PATCH /api/trucks/:id/assign-manager (admin only)
exports.assignManager = asyncHandler(async (req, res) => {
  const { managerId } = req.body || {};
  if (!managerId) return res.status(422).json({ success:false, error:{ message:'managerId required' } });
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== 'manager') {
    return res.status(400).json({ success:false, error:{ message:'Invalid managerId' } });
  }
  const truck = await Truck.findByIdAndUpdate(req.params.id, { manager: manager._id }, { new: true }).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success:true, data: truck });
});

// PATCH /api/trucks/:id/unassign-manager (admin only)
exports.unassignManager = asyncHandler(async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, { $unset: { manager: '' } }, { new: true });
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success:true, data: truck });
});

// GET /api/trucks/:id/staff (admin or manager of that truck)
exports.getTruckStaff = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role').populate('staff', 'id email name role staffRole');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  if (req.user.role === 'manager' && truck.manager && truck.manager.id !== req.user.id) {
    return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  res.json({ success:true, data: { id: truck.id, staff: truck.staff } });
});

// POST /api/trucks/:id/staff (assign existing staff user) (admin or manager of that truck)
exports.assignStaff = asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(422).json({ success:false, error:{ message:'userId required' } });
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  if (req.user.role === 'manager' && truck.manager && truck.manager.id !== req.user.id) {
    return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
  }
  const staffUser = await User.findById(userId);
  if (!staffUser || staffUser.role !== 'staff') {
    return res.status(400).json({ success:false, error:{ message:'Invalid staff userId' } });
  }
  // Assign
  const oldTruckId = staffUser.assignedTruck ? staffUser.assignedTruck.toString() : null;
  staffUser.assignedTruck = truck._id;
  // Track lastManager for recovery features
  if (truck.manager) {
    const mgrId = truck.manager._id || truck.manager.id || truck.manager;
    staffUser.lastManager = mgrId;
  }
  await staffUser.save();
  truck.staff = truck.staff || [];
  if (!truck.staff.find(id => id.toString() === staffUser._id.toString())) {
    truck.staff.push(staffUser._id);
    await truck.save();
  }
  // If staff was previously on a different truck, remove from that truck's staff list
  if (oldTruckId && oldTruckId !== truck.id) {
    await Truck.updateOne({ _id: oldTruckId }, { $pull: { staff: staffUser._id } });
  }
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success:true, data:{ truckId: truck.id, staffId: staffUser.id } });
});

// DELETE /api/trucks/:id/staff/:userId (remove staff assignment) (admin or manager of that truck)
exports.unassignStaff = asyncHandler(async (req, res) => {
  const { id: truckId, userId } = { id: req.params.id, userId: req.params.userId };
  const truck = await Truck.findById(truckId).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  if (req.user.role === 'manager' && truck.manager && truck.manager.id !== req.user.id) {
    return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
  }
  const staffUser = await User.findById(userId);
  if (!staffUser || staffUser.role !== 'staff' || (staffUser.assignedTruck && staffUser.assignedTruck.toString() !== truck.id)) {
    return res.status(400).json({ success:false, error:{ message:'Staff not assigned to this truck' } });
  }
  staffUser.assignedTruck = undefined;
  // Remember who last managed this staff for manager recovery
  if (truck.manager) {
    const mgrId = truck.manager._id || truck.manager.id || truck.manager;
    staffUser.lastManager = mgrId;
  }
  await staffUser.save();
  truck.staff = (truck.staff || []).filter(id => id.toString() !== staffUser._id.toString());
  await truck.save();
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success:true, data:{ truckId: truck.id, removedStaffId: staffUser.id } });
});

// PATCH /api/trucks/:id/route-plan (update predefined route schedule)
exports.updateRoutePlan = asyncHandler(async (req, res) => {
  const { routePlan } = req.body || {};
  if (!routePlan || !Array.isArray(routePlan.stops) || routePlan.stops.length < 2) {
    return res.status(422).json({ success:false, error:{ message:'routePlan with at least 2 stops is required' } });
  }
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  // Permission: admin or manager of truck
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }

  const cleanedStops = routePlan.stops.map(s => ({
    name: String(s.name || '').trim(),
    lat: Number(s.lat),
    lng: Number(s.lng),
    stayMin: Math.max(1, Number(s.stayMin || 15))
  })).filter(s => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng));

  if (cleanedStops.length < 2) {
    return res.status(422).json({ success:false, error:{ message:'routePlan stops must include valid name, lat, lng' } });
  }

  truck.routePlan = {
    timezone: routePlan.timezone || 'Asia/Kolkata',
    dailyStart: routePlan.dailyStart || '09:00',
    dailyEnd: routePlan.dailyEnd || '11:00',
    stops: cleanedStops
  };
  await truck.save();
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success:true, data:{ id: truck.id, routePlan: truck.routePlan } });
});

// PATCH /api/trucks/:id/status-location (update status and/or liveLocation)
exports.updateStatusLocation = asyncHandler(async (req, res) => {
  const { status, liveLocation } = req.body || {};
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  // Permission: admin or manager of truck
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  if (status) {
    const map = {
      open: 'active',
      closed: 'offline',
      'in-transit': 'en_route',
      in_transit: 'en_route',
      maintenance: 'maintenance',
      active: 'active',
      inactive: 'inactive',
      offline: 'offline',
      en_route: 'en_route'
    };
    const canonical = map[String(status).toLowerCase()] || status;
    truck.status = canonical;
  }
  if (liveLocation && typeof liveLocation === 'object') {
    const { lat, lng } = liveLocation;
    if (!truck.liveLocation) truck.liveLocation = {};
    if (typeof lat === 'number') truck.liveLocation.lat = lat;
    if (typeof lng === 'number') truck.liveLocation.lng = lng;
    truck.liveLocation.updatedAt = new Date();
  }
  await truck.save();
  try { emitTruckLocation(truck.id, truck.liveLocation); } catch {}
  try { await cacheDelByPrefix('trucks:'); } catch {}
  res.json({ success:true, data:{ id: truck.id, status: truck.status, liveLocation: truck.liveLocation } });
});
exports.deleteTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id _id');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });

  // Permission: admin OR manager of the truck
  if (req.user.role === 'manager') {
    const mgrId = truck.manager ? (truck.manager.id || String(truck.manager._id)) : null;
    if (!mgrId || mgrId !== String(req.user.id)) {
      return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }

  const adminOrMgrId = req.user.id;

  // 1) Unassign staff from this truck
  await User.updateMany(
    { role: 'staff', assignedTruck: truck._id },
    { $unset: { assignedTruck: '' }, $set: { lastManager: truck.manager ? (truck.manager._id || truck.manager.id || truck.manager) : adminOrMgrId } }
  );

  // 2) Delete related menu items
  await MenuItem.deleteMany({ truck: truck._id });

  // 3) Delete Orders and their chat rooms/messages for this truck
  try {
    const orders = await Order.find({ truck: truck._id }).select('_id');
    const orderIds = orders.map(o => o._id);
    if (orderIds.length) {
      const orderRooms = await ChatRoom.find({ type: 'order', order: { $in: orderIds } }).select('_id');
      const orderRoomIds = orderRooms.map(r => r._id);
      if (orderRoomIds.length) await ChatMessage.deleteMany({ room: { $in: orderRoomIds } });
      if (orderRoomIds.length) await ChatRoom.deleteMany({ _id: { $in: orderRoomIds } });
      await Order.deleteMany({ _id: { $in: orderIds } });
    }
  } catch {}

  try {
    await Reservation.deleteMany({ truck: truck._id });
  } catch {}

  try {
    const rooms = await ChatRoom.find({ type: 'truck', truck: truck._id }).select('_id');
    const roomIds = rooms.map(r => r._id);
    if (roomIds.length) await ChatMessage.deleteMany({ room: { $in: roomIds } });
    await ChatRoom.deleteMany({ type: 'truck', truck: truck._id });
  } catch {}

  await Truck.deleteOne({ _id: truck._id });

  try {
    await cacheDelByPrefix('trucks:');
    await cacheDelByPrefix(`menu:${truck._id}:`);
  } catch {}

  res.json({ success:true, data:{ id: String(truck._id), deleted:true } });
});
