import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const STATUS_OPTIONS = ['pending','confirmed','cancelled','completed'];

export default function AdminReservations() {
  const { token, user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReservations(token);
      if (res.success) setReservations(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, user]);

  async function updateStatus(id, status) {
    if (!status) return;
    setBusyId(id);
    setError(null);
    try {
      await api.updateReservationStatus(token, id, status);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Admin • Reservations</h2>
      {loading && <p>Loading reservations…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead>
            <tr>
              <th style={th}>Reservation</th>
              <th style={th}>Truck</th>
              <th style={th}>Date</th>
              <th style={th}>Time</th>
              <th style={th}>Party</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(r => (
              <tr key={r._id} style={{ borderTop:'1px solid #eee' }}>
                <td style={td}>{shortId(r._id)}</td>
                <td style={td}>{r.truck}</td>
                <td style={td}>{formatDate(r.date)}</td>
                <td style={td}>{r.slotStart} - {r.slotEnd}</td>
                <td style={td}>{r.partySize}</td>
                <td style={td}>
                  <select value={r.status || ''} onChange={e => updateStatus(r._id, e.target.value)} disabled={busyId === r._id}>
                    <option value="" disabled>Select</option>
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr><td style={td} colSpan={6}>No reservations found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function shortId(id) { return id ? String(id).slice(-6) : '—'; }
function formatDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString(); } catch { return '—'; } }
const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
