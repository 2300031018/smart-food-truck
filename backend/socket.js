const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value.id) return String(value.id);
    if (value._id) return String(value._id);
    if (typeof value.toString === 'function') return value.toString();
  }
  return String(value);
}

function normalizeOrder(order) {
  if (!order) return order;
  if (typeof order.toObject === 'function') {
    return order.toObject({ getters: true, virtuals: false });
  }
  return order;
}

function authFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.user; // { id, role }
  } catch (e) { return null; }
}

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    const user = authFromToken(token);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    // Rooms: truck:<id>, order:<id>, user:<id>, orders:manager:<id>, orders:admin
    socket.on('subscribe', ({ room }) => {
      if (typeof room === 'string') socket.join(room);
    });
    socket.on('unsubscribe', ({ room }) => {
      if (typeof room === 'string') socket.leave(room);
    });
  });
}

function emitTruckLocation(truckId, liveLocation, status, currentStopIndex) {
  if (!io) return;
  io.to(`truck:${truckId}`).emit('truck:location', { truckId, liveLocation, status, currentStopIndex });
}

function emitOrderCreated(order, meta = {}) {
  if (!io) return;
  const orderId = normalizeId(order?.id || order?._id);
  const truckId = normalizeId(meta.truckId || order?.truck);
  const customerId = normalizeId(meta.customerId || order?.customer);
  const managerId = normalizeId(meta.managerId);
  const payload = {
    orderId,
    truckId,
    status: order?.status,
    order: normalizeOrder(order)
  };

  if (orderId) io.to(`order:${orderId}`).emit('order:new', payload);
  if (truckId) io.to(`truck:${truckId}`).emit('order:new', payload);
  if (customerId) io.to(`user:${customerId}`).emit('order:new', payload);
  if (managerId) io.to(`orders:manager:${managerId}`).emit('order:new', payload);
  io.to('orders:admin').emit('order:new', payload);
}

function emitOrderUpdate(order, meta = {}) {
  if (!io) return;
  const orderId = normalizeId(order?.id || order?._id);
  const truckId = normalizeId(meta.truckId || order?.truck);
  const customerId = normalizeId(meta.customerId || order?.customer);
  const managerId = normalizeId(meta.managerId);
  const payload = {
    orderId,
    truckId,
    status: order?.status,
    order: normalizeOrder(order)
  };

  if (orderId) io.to(`order:${orderId}`).emit('order:update', payload);
  if (truckId) io.to(`truck:${truckId}`).emit('order:update', payload);
  if (customerId) io.to(`user:${customerId}`).emit('order:update', payload);
  if (managerId) io.to(`orders:manager:${managerId}`).emit('order:update', payload);
  io.to('orders:admin').emit('order:update', payload);
}

function emitChatMessage(roomId, message) {
  if (!io) return;
  io.to(`chat:${roomId}`).emit('chat:message', message);
}

function emitTruckUpdate(truckId, data) {
  if (!io) return;
  const id = normalizeId(truckId);
  io.emit('truck:update', { truckId: id, data });
}

function emitTruckDeleted(truckId) {
  if (!io) return;
  const id = normalizeId(truckId);
  io.emit('truck:deleted', { truckId: id });
}

module.exports = { initSocket, emitTruckLocation, emitOrderCreated, emitOrderUpdate, emitChatMessage, emitTruckUpdate, emitTruckDeleted };
