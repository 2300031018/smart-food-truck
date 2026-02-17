const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const Order = require('../models/Order');
const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');
const { emitChatMessage } = require('../socket');

async function ensureOrderRoom(orderId) {
  let room = await ChatRoom.findOne({ type: 'order', order: orderId });
  if (!room) room = await ChatRoom.create({ type: 'order', order: orderId });
  return room;
}

function canAccessOrder(user, order, truckManagerId) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return order.customer && order.customer.toString() === user.id;
  if (user.role === 'staff') return user.assignedTruck && order.truck.toString() === user.assignedTruck;
  if (user.role === 'manager') return truckManagerId && truckManagerId.toString() === user.id;
  return false;
}

function canAccessTruck(user, truck) {
  if (user.role === 'admin') return true;
  if (!truck) return false;
  if (user.role === 'manager') return truck.manager && truck.manager.toString() === user.id;
  if (user.role === 'staff') return Array.isArray(truck.staff) && truck.staff.map(String).includes(user.id);
  // customers shouldn't access truck chats
  return false;
}

exports.getOrderRoom = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ success:false, error:{ message:'Order not found' } });
  const truck = await Truck.findById(order.truck).select('manager');
  if (!canAccessOrder(req.user, order, truck?.manager)) {
    return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  }
  const room = await ensureOrderRoom(orderId);
  res.json({ success:true, data:{ id: room.id, type: 'order', order: order.id } });
});

exports.getTruckRoom = asyncHandler(async (req, res) => {
  const { truckId } = req.params;
  const truck = await Truck.findById(truckId).select('manager staff');
  if (!truck) return res.status(404).json({ success:false, error:{ message:'Truck not found' } });
  if (!canAccessTruck(req.user, truck)) return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
  let room = await ChatRoom.findOne({ type: 'truck', truck: truckId });
  if (!room) room = await ChatRoom.create({ type: 'truck', truck: truckId });
  res.json({ success:true, data:{ id: room.id, type: 'truck', truck: truckId } });
});

exports.listMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = await ChatRoom.findById(roomId);
  if (!room) return res.status(404).json({ success:false, error:{ message:'Room not found' } });
  // Basic auth: for order rooms, reuse order access logic
  if (room.type === 'order') {
    const order = await Order.findById(room.order);
    const truck = await Truck.findById(order.truck).select('manager');
    if (!canAccessOrder(req.user, order, truck?.manager)) {
      return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
    }
  }
  const messages = await ChatMessage.find({ room: room._id }).sort({ createdAt: 1 }).limit(200);
  res.json({ success:true, data: messages });
});

exports.postMessage = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ success:false, error:{ message:'text required' } });
  const room = await ChatRoom.findById(roomId);
  if (!room) return res.status(404).json({ success:false, error:{ message:'Room not found' } });
  // Basic auth: for order rooms, reuse order access logic
  if (room.type === 'order') {
    const order = await Order.findById(room.order);
    const truck = await Truck.findById(order.truck).select('manager');
    if (!canAccessOrder(req.user, order, truck?.manager)) {
      return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
    }
  }
  const msg = await ChatMessage.create({ room: room._id, sender: req.user.id, text: text.trim() });
  try { emitChatMessage(room.id || room._id, msg); } catch {}
  res.status(201).json({ success:true, data: msg });
});

