const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');
const { emitOrderUpdate } = require('../socket');

// Helper: compute snapshot items
async function buildItems(truckId, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const err = new Error('items array required');
    err.statusCode = 422;
    throw err;
  }
  const menuItemIds = rawItems.map(i => i.menuItem);
  const dbItems = await MenuItem.find({ _id: { $in: menuItemIds }, truck: truckId, isAvailable: true });
  const dbMap = new Map(dbItems.map(i => [i._id.toString(), i]));
  const items = rawItems.map(i => {
    const found = dbMap.get(i.menuItem);
    if (!found) {
      const e = new Error(`Menu item not available: ${i.menuItem}`);
      e.statusCode = 400; throw e;
    }
    const quantity = Number(i.quantity || 1);
    if (quantity < 1) { const e = new Error('quantity must be >=1'); e.statusCode = 400; throw e; }
    return {
      menuItem: found._id,
      name: found.name,
      quantity,
      unitPrice: found.price,
      lineTotal: found.price * quantity
    };
  });
  return items;
}

// POST /api/orders
exports.createOrder = asyncHandler(async (req, res) => {
  const { truck: truckId, items: rawItems, notes } = req.body;
  const { missingFields } = require('../utils/validation');
  const missing = missingFields(req.body, ['truck', 'items']);
  if (missing.length) {
    const err = new Error(`Missing required fields: ${missing.join(',')}`);
    err.statusCode = 422; throw err;
  }
  const truck = await Truck.findById(truckId).select('_id manager staff isActive');
  if (!truck || !truck.isActive) {
    const err = new Error('Truck inactive or not found');
    err.statusCode = 400; throw err;
  }
  const items = await buildItems(truckId, rawItems);
  const total = items.reduce((s,i)=> s + i.lineTotal, 0);
  const order = await Order.create({ customer: req.user.id, truck: truckId, items, total, notes });
  res.status(201).json({ success: true, data: order });
});

// GET /api/orders
// - customer: own orders
// - admin: all
// - manager/staff: orders for trucks they manage/work
exports.getOrders = asyncHandler(async (req, res) => {
  const baseQuery = {};
  if (req.user.role === 'customer') {
    baseQuery.customer = req.user.id;
  } else if (req.user.role === 'admin') {
    // no filter
  } else if (req.user.role === 'staff') {
    // staff strictly limited to their single assignedTruck
    if (!req.user.assignedTruck) {
      baseQuery.truck = '__none__';
    } else {
      baseQuery.truck = req.user.assignedTruck;
    }
  } else { // manager
    const trucks = await Truck.find({ manager: req.user.id }).select('_id');
    const ids = trucks.map(t => t._id);
    baseQuery.truck = { $in: ids.length ? ids : ['__none__'] };
  }
  const orders = await Order.find(baseQuery).sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

// GET /api/orders/:id
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: { message: 'Order not found' } });
  // Authorization check
  if (req.user.role === 'customer' && order.customer.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  if (req.user.role === 'staff') {
    if (!req.user.assignedTruck || order.truck.toString() !== req.user.assignedTruck) {
      return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
    }
  } else if (req.user.role === 'manager') {
    const truck = await Truck.findOne({ _id: order.truck, manager: req.user.id }).select('_id');
    if (!truck) return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  res.json({ success: true, data: order });
});

// PATCH /api/orders/:id/status  (manager/staff/admin)
exports.updateStatus = asyncHandler(async (req, res) => {
  let { status, reason } = req.body;
  // Accept synonyms
  const synonyms = { in_progress: 'preparing', 'in-progress': 'preparing', completed: 'delivered' };
  if (status && synonyms[status]) status = synonyms[status];
  const allowedTarget = ['pending','preparing','ready','delivered','cancelled'];
  if (!allowedTarget.includes(status)) return res.status(400).json({ success:false, error:{ message:'Invalid status' } });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success:false, error:{ message:'Order not found' } });

  // Normalize legacy statuses in-memory
  if (order.status === 'accepted') order.status = 'preparing';
  if (order.status === 'completed') order.status = 'delivered';

  // Customer special case: only cancel while pending
  if (req.user.role === 'customer') {
    if (status !== 'cancelled') return res.status(403).json({ success:false, error:{ message:'Customers may only cancel' } });
    if (order.status !== 'pending') return res.status(409).json({ success:false, error:{ message:'Cannot cancel after preparation starts' } });
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Customer cancelled';
    await order.save();
    return res.json({ success:true, data: order });
  }

  // Staff / Manager authorization to operate on this truck
  if (req.user.role === 'staff') {
    if (!req.user.assignedTruck || order.truck.toString() !== req.user.assignedTruck) {
      return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
    }
  } else if (req.user.role === 'manager') {
    const truck = await Truck.findOne({ _id: order.truck, manager: req.user.id }).select('_id');
    if (!truck) return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }

  const transitions = {
    pending: ['preparing','cancelled'],
    preparing: ['ready','cancelled'],
    ready: ['delivered','cancelled'],
    delivered: [],
    cancelled: []
  };
  const current = order.status;
  if (!transitions[current]) return res.status(409).json({ success:false, error:{ message:`Invalid current status ${current}` } });
  if (!transitions[current].includes(status)) {
    return res.status(409).json({ success:false, error:{ message:`Cannot move status from ${current} to ${status}` } });
  }

  // Manager can force cancel in preparing/ready with reason (already allowed by map)
  if (status === 'cancelled' && !reason && req.user.role === 'manager' && current !== 'pending') {
    return res.status(400).json({ success:false, error:{ message:'Reason required for forced cancel' } });
  }

  order.status = status;
  const now = new Date();
  if (status === 'preparing') {
    // assign staff if not already (claim implicit)
    if (req.user.role === 'staff' && !order.staff) order.staff = req.user.id;
  }
  if (status === 'ready') order.readyAt = now;
  if (status === 'delivered') order.deliveredAt = now;
  if (status === 'cancelled') {
    order.cancelledAt = now;
    order.cancelReason = reason || (req.user.role === 'staff' ? 'Staff cancelled' : 'Manager cancelled');
  }
  await order.save();
  try { emitOrderUpdate(order); } catch {}
  res.json({ success:true, data: order });
});

// markDelayed removed in MVP

