import { useEffect, useMemo } from 'react';
import { getSocket } from '../realtime/socket';

export function useSocketRooms({ token, rooms = [], listeners = {}, enabled = true }) {
  const safeRooms = useMemo(() => (Array.isArray(rooms) ? rooms.filter(Boolean) : []), [rooms]);
  const listenerEntries = useMemo(
    () => Object.entries(listeners || {}).filter(([, handler]) => typeof handler === 'function'),
    [listeners]
  );
  const roomsKey = safeRooms.join('|');
  const listenerEvents = listenerEntries.map(([event]) => event).join('|');
  const listenerHandlers = listenerEntries.map(([, handler]) => handler);

  useEffect(() => {
    if (!token || !enabled || (safeRooms.length === 0 && listenerEntries.length === 0)) {
      return undefined;
    }
    const socket = getSocket(token);
    safeRooms.forEach(room => socket.emit('subscribe', { room }));
    listenerEntries.forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      safeRooms.forEach(room => socket.emit('unsubscribe', { room }));
      listenerEntries.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [token, enabled, roomsKey, listenerEvents, ...listenerHandlers]);
}
