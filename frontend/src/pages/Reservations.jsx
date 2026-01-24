import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Reservations() {
  const { token, user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.getReservations(token)
      .then(res => { if (res.success && mounted) setReservations(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [token]);

  async function updateStatus(resv, status) {
    try {
      const res = await api.updateReservationStatus(token, resv._id, status);
      if (res.success) {
        setReservations(r => r.map(rv => rv._id === resv._id ? { ...rv, status } : rv));
      }
    } catch (e) {
      alert(e.message);
    }
  }

  async function cancel(resv) {
    try {
      const res = await api.cancelReservation(token, resv._id);
      if (res.success) {
        setReservations(r => r.map(rv => rv._id === resv._id ? { ...rv, status: 'cancelled' } : rv));
      }
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return <p style={{ padding: 20 }}>Loading reservations...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Reservations ({reservations.length})</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'system-ui' }}>
        <thead>
          <tr>
            <th style={th}>ID</th>
            <th style={th}>Truck</th>
            <th style={th}>Start</th>
            <th style={th}>End</th>
            <th style={th}>Status</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map(r => (
            <tr key={r._id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={td}>{r._id.slice(-6)}</td>
              <td style={td}>{r.truck?.name || r.truck}</td>
              <td style={td}>{new Date(r.startTime).toLocaleString()}</td>
              <td style={td}>{new Date(r.endTime).toLocaleString()}</td>
              <td style={td}>{r.status}</td>
              <td style={td}>
                {['admin','manager','staff'].includes(user.role) && r.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(r,'confirmed')}>Confirm</button>{' '}
                  </>
                )}
                {['pending','confirmed'].includes(r.status) && (
                  <button onClick={() => cancel(r)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign: 'left', padding: 6, background: '#f5f5f5', border: '1px solid #ddd' };
const td = { padding: 6, border: '1px solid #ddd', fontSize: 14 };
