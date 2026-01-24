import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket(token) {
  if (socketInstance) return socketInstance;
  // Prefer explicit backend URL via Vite env; fallback to common dev port swap
  const url = import.meta.env.VITE_BACKEND_URL || window.location.origin;
  socketInstance = io(url, {
    path: '/socket.io',
    autoConnect: true,
    transports: ['websocket'],
    auth: { token }
  });
  return socketInstance;
}

export function closeSocket() {
  if (socketInstance) {
    try { socketInstance.close(); } catch {}
    socketInstance = null;
  }
}
