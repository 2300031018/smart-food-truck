const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function authFromToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.user; // { id, role }
  } catch (e) { return null; }
}

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST'] }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    const user = authFromToken(token);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    // Rooms: truck:<id>, order:<id>, support:<userId>
    socket.on('subscribe', ({ room }) => {
      if (typeof room === 'string') socket.join(room);
    });
    socket.on('unsubscribe', ({ room }) => {
      if (typeof room === 'string') socket.leave(room);
    });
  });
}

function emitTruckLocation(truckId, liveLocation) {
  if (!io) return;
  io.to(`truck:${truckId}`).emit('truck:location', { truckId, liveLocation });
}

function emitOrderUpdate(order) {
  if (!io) return;
  io.to(`order:${order.id || order._id}`).emit('order:update', { orderId: order.id || order._id, status: order.status });
}

function emitChatMessage(roomId, message) {
  if (!io) return;
  io.to(`chat:${roomId}`).emit('chat:message', message);
}

module.exports = { initSocket, emitTruckLocation, emitOrderUpdate, emitChatMessage };
