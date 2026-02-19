const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { emitTruckLocation, emitTruckUpdate, emitTruckDeleted } = require('../socket');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

const VALID_TRUCK_STATUSES = new Set(['OPEN', 'PREPARING', 'SERVING', 'SOLD_OUT', 'CLOSED', 'MOVING']);
const TRUCK_STATUS_ALIASES = {
  active: 'OPEN',
  open: 'OPEN',
  preparing: 'PREPARING',
  serving: 'SERVING',
  sold_out: 'SOLD_OUT',
  'sold-out': 'SOLD_OUT',
  closed: 'CLOSED',
  inactive: 'CLOSED',
  offline: 'CLOSED',
  maintenance: 'CLOSED',
  moving: 'MOVING',
  en_route: 'MOVING',
  'en-route': 'MOVING',
  in_transit: 'MOVING',
  'in-transit': 'MOVING'
};

function normalizeTruckStatus(value) {
  if (!value) return null;
  const key = String(value).trim();
  if (!key) return null;
  const mapped = TRUCK_STATUS_ALIASES[key.toLowerCase()];
  if (mapped) return mapped;
  const upper = key.toUpperCase();
  return VALID_TRUCK_STATUSES.has(upper) ? upper : null;
}

function normalizeTruckRecord(truck) {
  if (!truck) return truck;
  const normalized = normalizeTruckStatus(truck.status) || truck.status;
  return { ...truck, status: normalized };
}

function getDefaultRoutePlan() {
  return {
    name: 'Central Vijayawada Route',
    timezone: 'Asia/Kolkata',
    dailyStart: '09:00',
    dailyEnd: '11:00',
    stops: [
      { name: 'Benz Circle', lat: 16.4957, lng: 80.6542, waitTime: 120 },
      { name: 'Siddhartha College', lat: 16.5047, lng: 80.6478, waitTime: 120 },
      { name: 'Governorpet', lat: 16.5183, lng: 80.6315, waitTime: 120 },
      { name: 'Bhavani Island', lat: 16.5233, lng: 80.6016, waitTime: 150 }
    ]
  };
}

function normalizeRoutePlan(routePlan) {
  if (!routePlan || !Array.isArray(routePlan.stops)) return null;
  if (routePlan.stops.length < 2) return null;
  const stops = routePlan.stops.map(s => {
    const waitTime = Number.isFinite(Number(s.waitTime)) ? Number(s.waitTime) : Number(s.stayMin);
    return {
      name: String(s.name || '').trim(),
      lat: Number(s.lat),
      lng: Number(s.lng),
      waitTime: Math.max(1, Number.isFinite(waitTime) ? waitTime : 15)
    };
  }).filter(s => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (stops.length < 2) return null;
  return {
    name: String(routePlan.name || '').trim() || undefined,
    timezone: routePlan.timezone || 'Asia/Kolkata',
    dailyStart: routePlan.dailyStart || '09:00',
    dailyEnd: routePlan.dailyEnd || '11:00',
    stops
  };
}

function ensureRoutePlan(routePlan) {
  const normalized = normalizeRoutePlan(routePlan);
  return normalized || getDefaultRoutePlan();
}

function clampStopIndex(index, stops) {
  const max = Math.max(0, (stops?.length || 1) - 1);
  const next = Number.isFinite(Number(index)) ? Number(index) : 0;
  return Math.min(Math.max(next, 0), max);
}

function getCurrentLocationFromRoute(routePlan, currentStopIndex) {
  const stops = routePlan?.stops || [];
  if (!stops.length) return null;
  const index = clampStopIndex(currentStopIndex, stops);
  const stop = stops[index];
  return stop ? { lat: stop.lat, lng: stop.lng } : null;
}

exports.applyDefaultRoutePlanDefaults = asyncHandler(async (req, res) => {
  const filter = {
    $or: [
      { routePlan: { $exists: false } },
      { 'routePlan.stops.0': { $exists: false } }
    ]
  };
  const update = { routePlan: getDefaultRoutePlan() };
  const result = await Truck.updateMany(filter, update);
  res.json({ success: true, data: { matched: result.matchedCount || result.n, modified: result.modifiedCount || result.nModified } });
});

exports.createTruck = asyncHandler(async (req, res) => {
  const { managerId, routePlan, status, currentStopIndex, ...rest } = req.body || {};
  let managerToSet = req.user.id;
  if (req.user.role === 'admin' && managerId) {
    const User = require('../models/User');
    const mgr = await User.findById(managerId);
    if (!mgr || mgr.role !== 'manager') {
      return res.status(400).json({ success: false, error: { message: 'managerId must reference an existing manager user' } });
    }
    managerToSet = mgr._id;
  }
  const normalizedRoutePlan = normalizeRoutePlan(routePlan);
  if (!normalizedRoutePlan) {
    return res.status(422).json({ success: false, error: { message: 'routePlan with at least 2 valid stops is required' } });
  }
  const normalizedStatus = 'SERVING';
  const nextStopIndex = clampStopIndex(currentStopIndex, normalizedRoutePlan.stops);
  const currentLocation = getCurrentLocationFromRoute(normalizedRoutePlan, nextStopIndex);
  let truck = await Truck.create({
    ...rest,
    status: normalizedStatus,
    routePlan: normalizedRoutePlan,
    currentStopIndex: nextStopIndex,
    currentLocation,
    location: currentLocation,
    manager: managerToSet
  });
  truck = await Truck.findById(truck._id).populate('manager', 'id email name role');
  res.status(201).json({ success: true, data: truck });
  emitTruckUpdate(truck.id, truck);
});

exports.getTrucks = asyncHandler(async (req, res) => {
  const trucks = await Truck.find({ isActive: true }).populate('manager', 'id email name role').populate('staff', 'id');
  const data = trucks.map(t => ({
    id: t.id,
    _id: t._id,
    name: t.name,
    description: t.description,
    cuisineType: t.cuisineType,
    status: normalizeTruckStatus(t.status) || t.status,
    location: t.location || null,
    liveLocation: t.liveLocation || null,
    currentLocation: t.currentLocation || null,
    currentStopIndex: Number.isFinite(t.currentStopIndex) ? t.currentStopIndex : 0,
    routePlan: ensureRoutePlan(t.routePlan),
    manager: t.manager ? { id: t.manager.id, email: t.manager.email, name: t.manager.name } : null,
    staffCount: (t.staff || []).length
  }));
  res.json({ success: true, data });
});

exports.getTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role').populate('staff', 'id');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  const data = {
    id: truck.id,
    name: truck.name,
    description: truck.description,
    cuisineType: truck.cuisineType,
    status: normalizeTruckStatus(truck.status) || truck.status,
    location: truck.location || null,
    liveLocation: truck.liveLocation || null,
    currentLocation: truck.currentLocation || null,
    currentStopIndex: Number.isFinite(truck.currentStopIndex) ? truck.currentStopIndex : 0,
    routePlan: ensureRoutePlan(truck.routePlan),
    manager: truck.manager ? { id: truck.manager.id, email: truck.manager.email, name: truck.manager.name } : null,
    staffCount: (truck.staff || []).length
  };
  res.json({ success: true, data });
});

exports.getManagedTrucks = asyncHandler(async (req, res) => {
  if (req.user.role === 'manager') {
    const trucks = await Truck.find({ manager: req.user.id }).populate('manager', 'id email name role');
    return res.json({ success: true, data: trucks.map(t => normalizeTruckRecord(t.toObject ? t.toObject() : t)) });
  }
  if (req.user.role === 'admin') {
    const trucks = await Truck.find({}).populate('manager', 'id email name role');
    return res.json({ success: true, data: trucks.map(t => normalizeTruckRecord(t.toObject ? t.toObject() : t)) });
  }
  return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

exports.updateTruck = asyncHandler(async (req, res) => {
  const { managerId, ...rest } = req.body || {};
  const update = { ...rest };
  if (rest.status) {
    const normalized = normalizeTruckStatus(rest.status);
    if (!normalized) {
      return res.status(400).json({ success: false, error: { message: 'Invalid truck status' } });
    }
    update.status = normalized;
  }
  if (managerId) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Only admin can reassign manager' } });
    }
    const User = require('../models/User');
    const mgr = await User.findById(managerId);
    if (!mgr || mgr.role !== 'manager') {
      return res.status(400).json({ success: false, error: { message: 'managerId must reference an existing manager user' } });
    }
    update.manager = mgr._id;
  }
  const truck = await Truck.findByIdAndUpdate(req.params.id, update, { new: true }).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  res.json({ success: true, data: truck });
  emitTruckUpdate(truck.id, truck);
});

exports.deactivateTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, { isActive: false, status: 'CLOSED' }, { new: true });
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  res.json({ success: true, data: truck });
});

exports.reactivateTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, { isActive: true, status: 'OPEN' }, { new: true });
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  res.json({ success: true, data: truck });
});

exports.assignManager = asyncHandler(async (req, res) => {
  const { managerId } = req.body || {};
  if (!managerId) return res.status(422).json({ success: false, error: { message: 'managerId required' } });
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== 'manager') {
    return res.status(400).json({ success: false, error: { message: 'Invalid managerId' } });
  }
  const truck = await Truck.findByIdAndUpdate(req.params.id, { manager: manager._id }, { new: true }).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  res.json({ success: true, data: truck });
});

exports.unassignManager = asyncHandler(async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, { $unset: { manager: '' } }, { new: true });
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  res.json({ success: true, data: truck });
});

exports.getTruckStaff = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role').populate('staff', 'id email name role staffRole');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager' && truck.manager && truck.manager.id !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  res.json({ success: true, data: { id: truck.id, staff: truck.staff } });
});

exports.assignStaff = asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(422).json({ success: false, error: { message: 'userId required' } });
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager' && truck.manager && truck.manager.id !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
  }
  const staffUser = await User.findById(userId);
  if (!staffUser || staffUser.role !== 'staff') {
    return res.status(400).json({ success: false, error: { message: 'Invalid staff userId' } });
  }
  const oldTruckId = staffUser.assignedTruck ? staffUser.assignedTruck.toString() : null;
  staffUser.assignedTruck = truck._id;
  if (truck.manager) staffUser.lastManager = truck.manager._id || truck.manager.id || truck.manager;
  await staffUser.save();
  truck.staff = truck.staff || [];
  if (!truck.staff.find(id => id.toString() === staffUser._id.toString())) {
    truck.staff.push(staffUser._id);
    await truck.save();
  }
  if (oldTruckId && oldTruckId !== truck.id) {
    await Truck.updateOne({ _id: oldTruckId }, { $pull: { staff: staffUser._id } });
  }
  res.json({ success: true, data: { truckId: truck.id, staffId: staffUser.id } });
});

exports.unassignStaff = asyncHandler(async (req, res) => {
  const { id: truckId, userId } = { id: req.params.id, userId: req.params.userId };
  const truck = await Truck.findById(truckId).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager' && truck.manager && truck.manager.id !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
  }
  const staffUser = await User.findById(userId);
  if (!staffUser || staffUser.role !== 'staff' || (staffUser.assignedTruck && staffUser.assignedTruck.toString() !== truck.id)) {
    return res.status(400).json({ success: false, error: { message: 'Staff not assigned to this truck' } });
  }
  staffUser.assignedTruck = undefined;
  if (truck.manager) staffUser.lastManager = truck.manager._id || truck.manager.id || truck.manager;
  await staffUser.save();
  truck.staff = (truck.staff || []).filter(id => id.toString() !== staffUser._id.toString());
  await truck.save();
  res.json({ success: true, data: { truckId: truck.id, removedStaffId: staffUser.id } });
});

exports.updateRoutePlan = asyncHandler(async (req, res) => {
  const { routePlan } = req.body || {};
  const normalizedRoutePlan = normalizeRoutePlan(routePlan);
  if (!normalizedRoutePlan) {
    return res.status(422).json({ success: false, error: { message: 'routePlan with at least 2 valid stops is required' } });
  }
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  truck.routePlan = normalizedRoutePlan;
  truck.currentStopIndex = clampStopIndex(truck.currentStopIndex, normalizedRoutePlan.stops);
  const nextLocation = getCurrentLocationFromRoute(normalizedRoutePlan, truck.currentStopIndex);
  if (nextLocation) {
    truck.currentLocation = nextLocation;
    if (!truck.location) truck.location = nextLocation;
  }
  const normalizedExisting = normalizeTruckStatus(truck.status);
  if (normalizedExisting) truck.status = normalizedExisting;
  await truck.save();
  res.json({ success: true, data: { id: truck.id, routePlan: truck.routePlan } });
  emitTruckUpdate(truck.id, { routePlan: truck.routePlan, currentStopIndex: truck.currentStopIndex });
});

exports.updateStatusLocation = asyncHandler(async (req, res) => {
  const { status, liveLocation } = req.body || {};
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  if (status) {
    const canonical = normalizeTruckStatus(status);
    if (!canonical) {
      return res.status(400).json({ success: false, error: { message: 'Invalid truck status' } });
    }
    truck.status = canonical;
  }
  if (liveLocation && typeof liveLocation === 'object') {
    const { lat, lng } = liveLocation;
    if (!truck.liveLocation) truck.liveLocation = {};
    if (typeof lat === 'number') truck.liveLocation.lat = lat;
    if (typeof lng === 'number') truck.liveLocation.lng = lng;
    truck.liveLocation.updatedAt = new Date();
  }
  const normalizedExisting = normalizeTruckStatus(truck.status);
  if (normalizedExisting) truck.status = normalizedExisting;
  await truck.save();
  try { emitTruckLocation(truck.id, truck.liveLocation, truck.status, truck.currentStopIndex); } catch { }
  res.json({ success: true, data: { id: truck.id, status: truck.status, liveLocation: truck.liveLocation } });
  emitTruckUpdate(truck.id, { status: truck.status, liveLocation: truck.liveLocation });
});

exports.startRoute = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  const normalizedRoutePlan = normalizeRoutePlan(truck.routePlan);
  if (!normalizedRoutePlan) return res.status(422).json({ success: false, error: { message: 'Truck route must have at least 2 valid stops' } });
  truck.routePlan = normalizedRoutePlan;
  truck.currentStopIndex = clampStopIndex(truck.currentStopIndex, normalizedRoutePlan.stops);
  truck.status = 'MOVING';
  const location = getCurrentLocationFromRoute(normalizedRoutePlan, truck.currentStopIndex);
  if (location) {
    truck.currentLocation = location;
    if (!truck.location) truck.location = location;
  }
  await truck.save();
  res.json({ success: true, data: { id: truck.id, status: truck.status, currentStopIndex: truck.currentStopIndex } });
});

exports.advanceRoute = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  const normalizedRoutePlan = normalizeRoutePlan(truck.routePlan);
  if (!normalizedRoutePlan) return res.status(422).json({ success: false, error: { message: 'Truck route must have at least 2 valid stops' } });
  const stops = normalizedRoutePlan.stops;
  const currentIndex = clampStopIndex(truck.currentStopIndex, stops);

  if (truck.status === 'MOVING') {
    const nextIndex = (currentIndex + 1) % stops.length;
    truck.currentStopIndex = nextIndex;
    truck.status = 'SERVING';
  } else if (truck.status === 'SERVING') {
    truck.status = 'MOVING';
  } else if (truck.status === 'CLOSED') {
    truck.status = 'MOVING';
  } else {
    return res.status(400).json({ success: false, error: { message: 'Route can only advance from CLOSED, MOVING, or SERVING' } });
  }

  const location = getCurrentLocationFromRoute(normalizedRoutePlan, truck.currentStopIndex);
  if (location) {
    truck.currentLocation = location;
    if (!truck.location) truck.location = location;
  }
  truck.routePlan = normalizedRoutePlan;
  await truck.save();
  res.json({ success: true, data: { id: truck.id, status: truck.status, currentStopIndex: truck.currentStopIndex } });
  emitTruckUpdate(truck.id, { status: truck.status, currentStopIndex: truck.currentStopIndex });
});

exports.stopRoute = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id email name role');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });
  if (req.user.role === 'manager') {
    if (!truck.manager || truck.manager.id !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  truck.status = 'CLOSED';
  await truck.save();
  res.json({ success: true, data: { id: truck.id, status: truck.status } });
  emitTruckUpdate(truck.id, { status: truck.status });
});

exports.forceAllServing = asyncHandler(async (req, res) => {
  const result = await Truck.updateMany({}, { status: 'SERVING', isActive: true });
  res.json({ success: true, data: { matched: result.matchedCount || result.n, modified: result.modifiedCount || result.nModified } });
});

exports.deleteTruck = asyncHandler(async (req, res) => {
  const truck = await Truck.findById(req.params.id).populate('manager', 'id _id');
  if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });

  if (req.user.role === 'manager') {
    const mgrId = truck.manager ? (truck.manager.id || String(truck.manager._id)) : null;
    if (!mgrId || mgrId !== String(req.user.id)) return res.status(403).json({ success: false, error: { message: 'Not manager of this truck' } });
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  await User.updateMany({ role: 'staff', assignedTruck: truck._id }, { $unset: { assignedTruck: '' }, $set: { lastManager: truck.manager ? (truck.manager._id || truck.manager.id || truck.manager) : req.user.id } });
  await MenuItem.deleteMany({ truck: truck._id });

  // 3) Delete Orders for this truck
  await Order.deleteMany({ truck: truck._id });

  await Truck.deleteOne({ _id: truck._id });
  res.json({ success: true, data: { id: String(truck._id), deleted: true } });
  emitTruckDeleted(truck._id);
});
