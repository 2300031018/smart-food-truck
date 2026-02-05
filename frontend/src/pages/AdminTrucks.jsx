import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const STATUS_OPTIONS = ['open','closed','in-transit','maintenance','active','inactive'];

export default function AdminTrucks() {
  const { token, user } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const [trucksRes, mgrRes] = await Promise.all([
        api.getManagedTrucks(token),
        api.getManagers(token, { includeInactive: true })
      ]);
      if (trucksRes.success) setTrucks(trucksRes.data || []);
      if (mgrRes.success) setManagers(mgrRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, user]);

  async function updateManager(truckId, managerId) {
    setBusyId(truckId);
    setError(null);
    try {
      if (managerId) await api.assignManager(token, truckId, managerId);
      else await api.unassignManager(token, truckId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(truckId, status) {
    if (!status) return;
    setBusyId(truckId);
    setError(null);
    try {
      await api.updateTruckStatusLocation(token, truckId, { status });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(truckId, isActive) {
    setBusyId(truckId);
    setError(null);
    try {
      if (isActive) await api.deactivateTruck(token, truckId);
      else await api.reactivateTruck(token, truckId);
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
      <h2>Admin • Trucks</h2>
      {loading && <p>Loading trucks…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead>
            <tr>
              <th style={th}>Truck</th>
              <th style={th}>Manager</th>
              <th style={th}>Status</th>
              <th style={th}>Active</th>
            </tr>
          </thead>
          <tbody>
            {trucks.map(t => (
              <tr key={t.id || t._id} style={{ borderTop:'1px solid #eee' }}>
                <td style={td}>{t.name}</td>
                <td style={td}>
                  <select
                    value={t.manager?.id || t.manager?._id || ''}
                    onChange={e => updateManager(t.id || t._id, e.target.value)}
                    disabled={busyId === (t.id || t._id)}
                  >
                    <option value="">Unassigned</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.name || m.email}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <select
                    value={t.status || ''}
                    onChange={e => updateStatus(t.id || t._id, e.target.value)}
                    disabled={busyId === (t.id || t._id)}
                  >
                    <option value="" disabled>Select status</option>
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <button onClick={() => toggleActive(t.id || t._id, t.isActive !== false)} disabled={busyId === (t.id || t._id)}>
                    {t.isActive === false ? 'Reactivate' : 'Deactivate'}
                  </button>
                </td>
              </tr>
            ))}
            {trucks.length === 0 && (
              <tr><td style={td} colSpan={4}>No trucks found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
