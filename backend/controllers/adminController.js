const asyncHandler = require('../utils/asyncHandler');
const Truck = require('../models/Truck');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');

// POST /api/admin/cleanup-orphans
// Removes orphan docs and fixes dangling references across the project.
// - Delete MenuItems whose truck no longer exists
// - Delete Menus whose truckId no longer exists
// - Delete ChatRooms (type:'truck') whose truck no longer exists and their ChatMessages
// - Delete ChatMessages whose room no longer exists
// - Delete Orders/Reservations whose truck or customer no longer exists
// - Ensure truck.staff do not contain non-existent users; prune
// - Ensure staff.assignedTruck points to an existing truck; if not, unset and keep lastManager
// - Ensure Truck.manager references an existing manager; if not, unset
exports.cleanupOrphans = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success:false, error:{ message:'Forbidden' } });

  const summary = { menuItemsDeleted:0, menusDeleted:0, chatRoomsDeleted:0, chatMessagesDeleted:0, ordersDeleted:0, reservationsDeleted:0, truckStaffPruned:0, staffUnassigned:0, trucksManagerUnset:0 };

  // Build existing ids
  const trucks = await Truck.find({}).select('_id manager staff');
  const truckIds = new Set(trucks.map(t => String(t._id)));
  const users = await User.find({}).select('_id role assignedTruck');
  const userIds = new Set(users.map(u => String(u._id)));
  const customerIds = new Set(users.filter(u => u.role === 'customer').map(u => String(u._id)));

  // 1) Orphan MenuItems
  const orphanItems = await MenuItem.find({}).select('_id truck');
  const orphanItemIds = orphanItems.filter(i => !truckIds.has(String(i.truck))).map(i => i._id);
  if (orphanItemIds.length) {
    const r = await MenuItem.deleteMany({ _id: { $in: orphanItemIds } });
    summary.menuItemsDeleted = r.deletedCount || 0;
  }

  // Menu model removed in MVP

  // 2) Orphan ChatRooms by truck
  const rooms = await ChatRoom.find({ type: 'truck' }).select('_id truck');
  const orphanRooms = rooms.filter(r => !truckIds.has(String(r.truck)));
  if (orphanRooms.length) {
    const roomIds = orphanRooms.map(r => r._id);
    const m = await ChatMessage.deleteMany({ room: { $in: roomIds } });
    summary.chatMessagesDeleted += m.deletedCount || 0;
    const rr = await ChatRoom.deleteMany({ _id: { $in: roomIds } });
    summary.chatRoomsDeleted += rr.deletedCount || 0;
  }

  // 3) Orphan ChatMessages without rooms
  const roomIdsAll = new Set((await ChatRoom.find({}).select('_id')).map(r => String(r._id)));
  const strayMsgs = await ChatMessage.find({}).select('_id room');
  const strayMsgIds = strayMsgs.filter(m => !roomIdsAll.has(String(m.room))).map(m => m._id);
  if (strayMsgIds.length) {
    const dm = await ChatMessage.deleteMany({ _id: { $in: strayMsgIds } });
    summary.chatMessagesDeleted += dm.deletedCount || 0;
  }

  // 3b) Orphan Orders (missing truck or customer)
  const orders = await Order.find({}).select('_id truck customer');
  const orphanOrderIds = orders
    .filter(o => !truckIds.has(String(o.truck)) || !customerIds.has(String(o.customer)))
    .map(o => o._id);
  if (orphanOrderIds.length) {
    const r = await Order.deleteMany({ _id: { $in: orphanOrderIds } });
    summary.ordersDeleted = r.deletedCount || 0;
  }

  // 3c) Orphan Reservations (missing truck or customer)
  const reservations = await Reservation.find({}).select('_id truck customer');
  const orphanReservationIds = reservations
    .filter(r => !truckIds.has(String(r.truck)) || !customerIds.has(String(r.customer)))
    .map(r => r._id);
  if (orphanReservationIds.length) {
    const rdel = await Reservation.deleteMany({ _id: { $in: orphanReservationIds } });
    summary.reservationsDeleted = rdel.deletedCount || 0;
  }


  // 4) Prune truck.staff invalid references
  for (const t of trucks) {
    const before = (t.staff||[]).length;
    const pruned = (t.staff||[]).filter(id => userIds.has(String(id)));
    if (pruned.length !== before) {
      t.staff = pruned;
      await t.save();
      summary.truckStaffPruned += (before - pruned.length);
    }
  }

  // 5) Fix staff.assignedTruck pointing to missing truck
  const staffUsers = users.filter(u => u.role === 'staff');
  const brokenStaff = staffUsers.filter(u => u.assignedTruck && !truckIds.has(String(u.assignedTruck)));
  if (brokenStaff.length) {
    const ids = brokenStaff.map(u => u._id);
    const r = await User.updateMany({ _id: { $in: ids } }, { $unset: { assignedTruck: '' } });
    summary.staffUnassigned += r.modifiedCount || r.nModified || 0;
  }

  // 6) Ensure Truck.manager exists and is a manager; otherwise unset
  const managerUsers = new Set(users.filter(u => u.role === 'manager').map(u => String(u._id)));
  for (const t of trucks) {
    const mId = t.manager ? String(t.manager) : null;
    if (mId && !managerUsers.has(mId)) {
      await Truck.updateOne({ _id: t._id }, { $unset: { manager: '' } });
      summary.trucksManagerUnset += 1;
    }
  }

  res.json({ success:true, data: summary });
});

// Purge manager removed in MVP
