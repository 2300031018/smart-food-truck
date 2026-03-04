import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket(token) {
  if (socketInstance) return socketInstance;
  // Use VITE_API_URL or fallback to window.location.origin
  // In production, VITE_API_URL should point to the backend (e.g. https://...backend.onrender.com)
  const url = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_TARGET || window.location.origin;
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
    try { socketInstance.close(); } catch { }
    socketInstance = null;
  }
}
