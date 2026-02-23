import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { clearRoutePathsForTruck } from '../utils/routePathCache';

const STATUS_OPTIONS = ['OPEN', 'PREPARING', 'SERVING', 'SOLD_OUT', 'CLOSED', 'MOVING'];
import RouteEditorModal from '../components/RouteEditorModal';
import { useSocketRooms } from '../hooks/useSocketRooms';

export default function AdminTrucks() {
  const { token, user } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [editingTruck, setEditingTruck] = useState(null);

  // Creation State
  const [creating, setCreating] = useState(false);
  const [newTruck, setNewTruck] = useState({ name: '', description: '', managerId: '' });

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

  const DEFAULT_ROUTE_PLAN = {
    name: 'Central Route',
    timezone: 'Asia/Kolkata',
    dailyStart: '09:00',
    dailyEnd: '23:00',
    stops: []
  };

  async function handleCreateTruck(e) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const payload = {
        name: newTruck.name,
        description: newTruck.description,
        status: 'SERVING',
        currentStopIndex: 0,
        routePlan: DEFAULT_ROUTE_PLAN
      };
      if (newTruck.managerId) payload.managerId = newTruck.managerId;

      const res = await api.createTruck(token, payload);
      if (res.success) {
        setTrucks(prev => [...prev, res.data]);
        setNewTruck({ name: '', description: '', managerId: '' });
        setCreating(false);
        setEditingTruck(res.data); // Prompt to edit route immediately
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, user]);

  const handleTruckDeleted = useCallback(({ truckId }) => {
    if (!truckId) return;
    setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
    setEditingTruck(prev => (prev && (prev.id || prev._id) === truckId ? null : prev));
    clearRoutePathsForTruck(truckId);
  }, []);

  const listeners = useMemo(() => ({ 'truck:deleted': handleTruckDeleted }), [handleTruckDeleted]);
  useSocketRooms({ token, listeners, enabled: Boolean(token) });

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

  async function deleteTruck(truckId) {
    if (!window.confirm('Are you sure you want to delete this truck? This action cannot be undone.')) return;
    setBusyId(truckId);
    setError(null);
    try {
      await api.deleteTruck(token, truckId);
      clearRoutePathsForTruck(truckId);
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

  if (!token) return <p style={{ padding: 20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding: 20 }}>Forbidden</p>;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>Admin • Trucks</h2>
        <button onClick={() => setCreating(!creating)} className={`btn ${creating ? 'btn-danger' : 'btn-primary'}`}>
          {creating ? 'Cancel' : '+ New Truck'}
        </button>
      </div>

      {creating && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Onboard New Truck</h3>
          <form onSubmit={handleCreateTruck} style={{ display: 'grid', gap: 20, maxWidth: 600 }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Truck Name</label>
              <input
                required
                value={newTruck.name}
                onChange={e => setNewTruck(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. The Gourmet Grill"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
              <textarea
                value={newTruck.description}
                onChange={e => setNewTruck(prev => ({ ...prev, description: e.target.value }))}
                style={{ width: '100%', minHeight: 100 }}
                placeholder="Brief description of cuisine..."
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Assign Manager</label>
              <select
                value={newTruck.managerId}
                onChange={e => setNewTruck(prev => ({ ...prev, managerId: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">-- Select Manager --</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Truck'}
            </button>
          </form>
        </div>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading trucks…</p>}
      {error && <div style={{ color: 'var(--danger)', padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 20 }}>{error}</div>}

      {!loading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Truck</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Route</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trucks.map(t => (
                <tr key={t.id || t._id}>
                  <td><strong>{t.name}</strong></td>
                  <td>
                    <select
                      value={t.manager?.id || t.manager?._id || ''}
                      onChange={e => updateManager(t.id || t._id, e.target.value)}
                      disabled={busyId === (t.id || t._id)}
                      style={{ fontSize: 12, padding: '4px 8px' }}
                    >
                      <option value="">Unassigned</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.name || m.email}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={t.status || ''}
                      onChange={e => updateStatus(t.id || t._id, e.target.value)}
                      disabled={busyId === (t.id || t._id)}
                      style={{ fontSize: 12, padding: '4px 8px' }}
                    >
                      <option value="" disabled>Status</option>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${t.isActive === false ? 'badge-red' : 'badge-green'}`}>
                      {t.isActive === false ? 'Deactivated' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-primary" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }} onClick={() => setEditingTruck(t)}>Edit Route</button>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button className={`btn btn-sm ${t.isActive === false ? 'btn-primary' : 'btn-danger'}`} style={{ background: t.isActive === false ? '' : 'rgba(239, 68, 68, 0.1)', color: t.isActive === false ? '' : '#ef4444' }} onClick={() => toggleActive(t.id || t._id, t.isActive !== false)} disabled={busyId === (t.id || t._id)}>
                        {t.isActive === false ? 'Reactivate' : 'Deactivate'}
                      </button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => deleteTruck(t.id || t._id)} disabled={busyId === (t.id || t._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {trucks.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>No trucks found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {editingTruck && (
        <RouteEditorModal
          truck={editingTruck}
          token={token}
          onClose={() => setEditingTruck(null)}
          onSave={load}
        />
      )}
    </div>
  );
}

const th = { textAlign: 'left', padding: 6, background: '#f5f5f5', border: '1px solid #ddd', fontSize: 12 };
const td = { padding: 6, border: '1px solid #eee', fontSize: 13 };
const btnStyle = { padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' };
const inputStyle = { padding: '8px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%' };
const labelStyle = { display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500, color: '#374151' };
