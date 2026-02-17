const User = require('../models/User');
const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/users/bootstrap-admin (unauthenticated)
// Creates first admin OR updates existing admin if BOOTSTRAP_KEY header matches env BOOTSTRAP_KEY
exports.bootstrapAdmin = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(422).json({ success:false, error:{ message:'email and password required' } });
  }
  const strong = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;
  if (!strong.test(password)) {
    return res.status(400).json({ success:false, error:{ message:'Password too weak (need 8+, upper, lower, digit)' } });
  }
  const existingAdmin = await User.findOne({ role:'admin' });
  if (!existingAdmin) {
    const admin = await User.create({ email, password, name: name || 'Admin', role:'admin' });
    return res.status(201).json({ success:true, data:{ id:admin.id, email:admin.email, role:admin.role } });
  }
  const keyHeader = req.headers['x-bootstrap-key'];
  if (!process.env.BOOTSTRAP_KEY || keyHeader !== process.env.BOOTSTRAP_KEY) {
    return res.status(403).json({ success:false, error:{ message:'Admin exists; bootstrap key required' } });
  }
  if (email) existingAdmin.email = email;
  if (password) existingAdmin.password = password; // will re-hash via pre-save
  if (name) existingAdmin.name = name;
  await existingAdmin.save();
  return res.json({ success:true, data:{ id:existingAdmin.id, email:existingAdmin.email, role:existingAdmin.role, updated:true } });
});

// Admin creates manager
exports.createManager = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(422).json({ success:false, error:{ message:'name, email, password required' } });
  }
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ success:false, error:{ message:'Email already in use' } });
  const manager = await User.create({ email, password, name, role:'manager' });
  res.status(201).json({ success:true, data:{ id:manager.id, email:manager.email, role:manager.role } });
});

// Manager creates staff (must provide truckId the manager manages)
exports.createStaff = asyncHandler(async (req, res) => {
  const { email, password, name, truckId } = req.body || {};
  if (!email || !password || !name || !truckId) {
    return res.status(422).json({ success:false, error:{ message:'name, email, password, truckId required' } });
  }
  const truck = await Truck.findById(truckId);
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  if (req.user.role !== 'admin' && truck.manager?.toString() !== req.user.id) {
    return res.status(403).json({ success:false, error:{ message:'Not manager of this truck' } });
  }
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ success:false, error:{ message:'Email already in use' } });
  const staff = await User.create({ email, password, name, role:'staff', assignedTruck: truckId });
  // Append staff to truck.staff if array exists
  truck.staff = truck.staff || [];
  truck.staff.push(staff._id);
  await truck.save();
  const manager = await User.findById(truck.manager).select('id email name role');
  res.status(201).json({ success:true, data:{ 
    id:staff.id,
    email:staff.email,
    role:staff.role,
    assignedTruck: truckId,
    truckManager: manager ? { id: manager.id, email: manager.email, name: manager.name } : null
  } });
});

exports.updateStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const { name, email, password, staffRole } = req.body || {};
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  if (email && email !== staff.email) {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success:false, error:{ message:'Email already in use' } });
    staff.email = email;
  }
  if (name) staff.name = name;
  if (password) staff.password = password;
  if (staffRole) staff.staffRole = staffRole;
  await staff.save();
  res.json({ success:true, data:{ id: staff.id, updated:true } });
});

// Manager limited staff update (only for their trucks) - name and staffRole only
exports.managerUpdateStaffLimited = asyncHandler(async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const { name, staffRole } = req.body || {};
  if (!name && !staffRole) return res.status(400).json({ success:false, error:{ message:'No fields to update' } });
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  // Ensure staff belongs to a truck managed by this manager
  if (!staff.assignedTruck) return res.status(400).json({ success:false, error:{ message:'Staff not assigned to a truck' } });
  const truck = await Truck.findById(staff.assignedTruck).select('manager');
  if (!truck || truck.manager?.toString() !== req.user.id) {
    return res.status(403).json({ success:false, error:{ message:'Not manager of staff\'s truck' } });
  }
  if (name) staff.name = name;
  if (staffRole) staff.staffRole = staffRole;
  await staff.save();
  res.json({ success:true, data:{ id: staff.id, updated:true } });
});

exports.deactivateStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  staff.isActive = false;
  await staff.save();
  res.json({ success:true, data:{ id: staff.id, deactivated:true } });
});

exports.reactivateStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  staff.isActive = true;
  await staff.save();
  res.json({ success:true, data:{ id: staff.id, reactivated:true } });
});

// Admin hard delete staff: remove from trucks and delete user
// DELETE /api/users/staff/:id
exports.deleteStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  // Pull from any truck.staff arrays (assigned or old references)
  await Truck.updateMany({ staff: staff._id }, { $pull: { staff: staff._id } });
  await User.deleteOne({ _id: staff._id });
  res.json({ success:true, data:{ id: req.params.id, deleted:true } });
});

// Admin assign staff to truck (or move)
exports.assignStaffToTruck = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const { truckId } = req.body || {};
  if (!truckId) return res.status(422).json({ success:false, error:{ message:'truckId required' } });
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  const truck = await Truck.findById(truckId);
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  const oldTruckId = staff.assignedTruck ? staff.assignedTruck.toString() : null;
  // Update staff assignment
  staff.assignedTruck = truck._id;
  await staff.save();
  // Remove from old truck.staff
  if (oldTruckId) {
    await Truck.updateOne({ _id: oldTruckId }, { $pull: { staff: staff._id } });
  }
  // Add to new truck.staff
  await Truck.updateOne({ _id: truck._id }, { $addToSet: { staff: staff._id } });
  res.json({ success:true, data:{ id: staff.id, truckId: truck.id } });
});

exports.unassignStaffFromTruck = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!staff) return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
  const oldTruckId = staff.assignedTruck ? staff.assignedTruck.toString() : null;
  staff.assignedTruck = undefined;
  await staff.save();
  if (oldTruckId) await Truck.updateOne({ _id: oldTruckId }, { $pull: { staff: staff._id } });
  res.json({ success:true, data:{ id: staff.id, unassigned:true } });
});

// Admin lists managers (optionally include inactive)
// GET /api/users/managers?includeInactive=true
exports.listManagers = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';
  const roleQuery = includeInactive ? { role: 'manager' } : { role: 'manager', isActive: true };
  const managers = await User.find(roleQuery).select('id email name role isActive createdAt updatedAt');
  res.json({ success:true, data: managers.map(m => ({ id: m.id, email: m.email, name: m.name, role: m.role, isActive: m.isActive, createdAt: m.createdAt, updatedAt: m.updatedAt })) });
});

// Admin get single manager
exports.getManager = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const manager = await User.findOne({ _id: req.params.id, role:'manager' }).select('id email name role createdAt updatedAt');
  if (!manager) return res.status(404).json({ success:false, error:{ message:'Manager not found' } });
  res.json({ success:true, data: manager });
});

// Admin update manager (name, email, password)
exports.updateManager = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const { name, email, password } = req.body || {};
  if (!name && !email && !password) {
    return res.status(400).json({ success:false, error:{ message:'No fields to update' } });
  }
  const manager = await User.findOne({ _id: req.params.id, role:'manager' });
  if (!manager) return res.status(404).json({ success:false, error:{ message:'Manager not found' } });
  if (email && email !== manager.email) {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success:false, error:{ message:'Email already in use' } });
    manager.email = email;
  }
  if (name) manager.name = name;
  if (password) manager.password = password; // pre-save hook will hash
  await manager.save();
  res.json({ success:true, data:{ id: manager.id, email: manager.email, name: manager.name, role: manager.role, updated:true } });
});

// Admin delete (deactivate) manager with reassignment to Admin
// DELETE /api/users/managers/:id
// Reassigns all trucks managed by this manager to the acting admin (req.user)
// and marks the manager as inactive. Staff assigned to those trucks automatically
// fall under the admin via truck.manager. We also update staff.lastManager to the admin for traceability.
exports.deleteManager = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const manager = await User.findOne({ _id: req.params.id, role:'manager' });
  if (!manager) return res.status(404).json({ success:false, error:{ message:'Manager not found' } });

  // Find trucks managed by this manager
  const trucks = await Truck.find({ manager: manager._id }).select('_id');
  const truckIds = trucks.map(t => t._id);

  // Reassign trucks to acting admin (next higher authority)
  const adminId = req.user.id;
  let reassignedCount = 0;
  if (truckIds.length > 0) {
    const result = await Truck.updateMany({ _id: { $in: truckIds } }, { $set: { manager: adminId } });
    reassignedCount = (result && (result.modifiedCount || result.nModified)) || 0;

    // No staff lastManager tracking in MVP
  }

  // Soft deactivate the manager (keep role)
  manager.isActive = false;
  await manager.save();

  res.json({ success:true, data:{ id: manager.id, deactivated:true, reassignedTrucks: reassignedCount } });
});

// Admin reactivate manager
exports.reactivateManager = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const manager = await User.findById(req.params.id);
  if (!manager || manager.role !== 'manager') {
    return res.status(404).json({ success:false, error:{ message:'Manager not found' } });
  }
  manager.isActive = true;
  await manager.save();
  res.json({ success:true, data:{ id: manager.id, reactivated:true } });
});

// List staff with their manager (admin sees all, manager sees only their trucks' staff)
exports.listStaff = asyncHandler(async (req, res) => {
  const baseQuery = { role: 'staff' };
  if (req.user.role === 'manager') {
    // find trucks managed by manager
    const trucks = await Truck.find({ manager: req.user.id }).select('_id');
    const ids = trucks.map(t => t._id);
    baseQuery.assignedTruck = { $in: ids };
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const staffUsers = await User.find(baseQuery).select('id email name role assignedTruck isActive');
  // Fetch truck + manager details
  const truckIds = [...new Set(staffUsers.filter(s => s.assignedTruck).map(s => s.assignedTruck.toString()))];
  const truckDocs = await Truck.find({ _id: { $in: truckIds } }).populate('manager', 'id email name role');
  const truckMap = new Map(truckDocs.map(t => [t.id, t]));
  const result = staffUsers.map(s => {
    const truck = s.assignedTruck ? truckMap.get(s.assignedTruck.toString()) : null;
    return {
      id: s.id,
      email: s.email,
      name: s.name,
      role: s.role,
      isActive: s.isActive,
      assignedTruck: s.assignedTruck || null,
      truckManager: truck && truck.manager ? { id: truck.manager.id, email: truck.manager.email, name: truck.manager.name } : null
    };
  });
  res.json({ success:true, data: result });
});

// Managers: list unassigned staff they previously managed (to re-add)
// GET /api/users/staff/reclaim
exports.listReclaimableStaff = asyncHandler(async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  const users = await User.find({ role: 'staff', assignedTruck: { $exists: false }, lastManager: req.user.id })
    .select('id email name role');
  res.json({ success:true, data: users.map(u => ({ id: u.id, email: u.email, name: u.name })) });
});

// Admin overview: managers with their trucks and staff per truck + status counts
exports.managersOverview = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  // Fetch managers
  const managers = await User.find({ role:'manager', isActive: true }).select('id name email role');
  const managerIds = managers.map(m => m._id);
  // Fetch trucks for those managers
  const trucks = await Truck.find({ manager: { $in: managerIds } }).select('_id name manager status liveLocation');
  const truckIds = trucks.map(t => t._id);
  // Fetch staff assigned to those trucks
  const staff = await User.find({ role:'staff', assignedTruck: { $in: truckIds } }).select('id name email assignedTruck');
  // Group staff by truck
  const staffByTruck = new Map();
  for (const s of staff) {
    const key = s.assignedTruck.toString();
    if (!staffByTruck.has(key)) staffByTruck.set(key, []);
    staffByTruck.get(key).push({ id: s.id, name: s.name, email: s.email });
  }
  // Group trucks by manager
  const trucksByManager = new Map();
  for (const t of trucks) {
    const key = t.manager.toString();
    if (!trucksByManager.has(key)) trucksByManager.set(key, []);
    trucksByManager.get(key).push({
      id: t.id,
      name: t.name,
      status: t.status,
      liveLocation: t.liveLocation || null,
      staff: staffByTruck.get(t._id.toString()) || [],
      staffCount: (staffByTruck.get(t._id.toString()) || []).length
    });
  }
  const overview = managers.map(m => {
    const mgrTrucks = trucksByManager.get(m._id.toString()) || [];
    const totalStaff = mgrTrucks.reduce((acc, t) => acc + t.staffCount, 0);
    const statusCounts = mgrTrucks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      truckCount: mgrTrucks.length,
      totalStaff,
      statusCounts,
      trucks: mgrTrucks
    };
  });
  res.json({ success:true, data: overview });
});

// Admin hierarchical view: managers -> trucks -> staff (detailed)
// GET /api/users/managers/hierarchy
// Optional: ?includeInactive=true to include inactive managers/trucks
exports.managersHierarchy = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';

  const managerQuery = includeInactive ? { role: 'manager' } : { role: 'manager', isActive: true };
  const managers = await User.find(managerQuery)
    .select('id name email role isActive createdAt updatedAt lastLoginAt');
  const managerIds = managers.map(m => m._id);

  const truckQuery = { manager: { $in: managerIds } };
  if (!includeInactive) truckQuery.isActive = true;
  const trucks = await Truck.find(truckQuery)
    .select('id name slug description cuisineType location liveLocation schedule operatingHours capacity status isActive manager createdAt updatedAt');
  const truckIds = trucks.map(t => t._id);

  const staff = await User.find({ role: 'staff', assignedTruck: { $in: truckIds } })
    .select('id name email role staffRole isActive lastLoginAt assignedTruck');

  // Group staff by truck
  const staffByTruck = new Map();
  for (const s of staff) {
    const key = s.assignedTruck.toString();
    if (!staffByTruck.has(key)) staffByTruck.set(key, []);
    staffByTruck.get(key).push({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      staffRole: s.staffRole,
      isActive: s.isActive,
  lastLoginAt: s.lastLoginAt || null
    });
  }

  // Group trucks by manager with staff nested
  const trucksByManager = new Map();
  for (const t of trucks) {
    const key = t.manager.toString();
    if (!trucksByManager.has(key)) trucksByManager.set(key, []);
    const staffList = staffByTruck.get(t._id.toString()) || [];
    trucksByManager.get(key).push({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description || null,
      cuisineType: t.cuisineType || null,
      location: t.location || null,
      liveLocation: t.liveLocation || null,
      schedule: t.schedule || [],
      operatingHours: t.operatingHours || [],
      capacity: t.capacity || 0,
      status: t.status,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      staffCount: staffList.length,
      staff: staffList
    });
  }

  // Compose hierarchy
  const result = managers.map(m => {
    const mgrTrucks = trucksByManager.get(m._id.toString()) || [];
    const totalStaff = mgrTrucks.reduce((acc, t) => acc + t.staffCount, 0);
    const statusCounts = mgrTrucks.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      isActive: m.isActive,
      lastLoginAt: m.lastLoginAt || null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      totals: { trucks: mgrTrucks.length, staff: totalStaff },
      statusCounts,
      trucks: mgrTrucks
    };
  });

  res.json({ success:true, data: result, meta: { includeInactive } });
});

// GET /api/users/me/team
// staff: returns their assigned truck (basic fields), its manager, and fellow staff
// manager: returns list of their trucks with staff for each
// admin: optional query role=manager|staff to mimic but by default 400 (avoid broad expensive)
exports.myTeam = asyncHandler(async (req, res) => {
  // Admin emulation support
  const emulateRole = (req.user.role === 'admin') ? (req.query.as || null) : null;

  if (req.user.role === 'staff' || emulateRole === 'staff') {
    const targetStaffId = emulateRole === 'staff' ? (req.query.staffId || null) : req.user.id;
    const staffUser = await User.findById(targetStaffId).select('id name email role assignedTruck staffRole');
    if (!staffUser || staffUser.role !== 'staff') {
      if (emulateRole === 'staff') return res.status(404).json({ success:false, error:{ message:'Emulated staff not found' } });
      return res.status(404).json({ success:false, error:{ message:'Staff not found' } });
    }
    if (!staffUser.assignedTruck) {
      return res.json({ success:true, data:{ role: 'staff', assignedTruck: null, staff: [], manager: null, meta: emulateRole ? { emulated: true } : undefined } });
    }
    const truck = await Truck.findById(staffUser.assignedTruck).populate('manager', 'id name email role').populate('staff', 'id name email role staffRole');
    if (!truck) {
      return res.json({ success:true, data:{ role: 'staff', assignedTruck: null, staff: [], manager: null, meta: emulateRole ? { emulated: true } : undefined } });
    }
    const staff = (truck.staff || []).map(s => ({ id: s.id, name: s.name, email: s.email, role: s.role, staffRole: s.staffRole }));
    const manager = truck.manager ? { id: truck.manager.id, name: truck.manager.name, email: truck.manager.email } : null;
    return res.json({ success:true, data:{ role: 'staff', truck: { id: truck.id, name: truck.name, status: truck.status }, manager, staff, meta: emulateRole ? { emulated: true, targetStaffId } : undefined }});
  }
  if (req.user.role === 'manager' || emulateRole === 'manager') {
    const targetManagerId = emulateRole === 'manager' ? (req.query.managerId || null) : req.user.id;
    const managerUser = await User.findById(targetManagerId).select('id role');
    if (!managerUser || managerUser.role !== 'manager') {
      if (emulateRole === 'manager') return res.status(404).json({ success:false, error:{ message:'Emulated manager not found' } });
      return res.status(404).json({ success:false, error:{ message:'Manager not found' } });
    }
    // Fetch trucks managed by manager
  const trucks = await Truck.find({ manager: managerUser.id }).select('id name status liveLocation staff').populate('staff', 'id name email role staffRole lastLoginAt');
    const mapped = trucks.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      liveLocation: t.liveLocation || null,
      staffCount: (t.staff||[]).length,
  staff: (t.staff||[]).map(s => ({ id: s.id, name: s.name, email: s.email, staffRole: s.staffRole, lastLoginAt: s.lastLoginAt || null }))
    }));
    return res.json({ success:true, data:{ role: 'manager', trucks: mapped, meta: emulateRole ? { emulated: true, targetManagerId } : undefined }});
  }
  if (req.user.role === 'admin') {
    return res.status(400).json({ success:false, error:{ message:'Provide ?as=staff&staffId=... or ?as=manager&managerId=...' } });
  }
  return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
});

// updateMyStatus removed in MVP
