import { API_BASE } from './client';

function headers(token){
  return { 'Content-Type':'application/json', ...(token?{ Authorization:`Bearer ${token}` }: {}) };
}

async function get(url, token){
  const res = await fetch(`${API_BASE}${url}`, { headers: headers(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || 'Request failed');
  return data;
}
async function post(url, body, token){
  const res = await fetch(`${API_BASE}${url}`, { method:'POST', headers: headers(token), body: JSON.stringify(body||{}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || 'Request failed');
  return data;
}

export const chatApi = {
  getOrderRoom: (token, orderId) => get(`/chats/order/${orderId}/room`, token),
  getTruckRoom: (token, truckId) => get(`/chats/truck/${truckId}/room`, token),
  listMessages: (token, roomId) => get(`/chats/rooms/${roomId}/messages`, token),
  postMessage: (token, roomId, text) => post(`/chats/rooms/${roomId}/messages`, { text }, token)
};
