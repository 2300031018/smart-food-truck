import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ManagerMenuPanel from '../components/manager/ManagerMenuPanel';
import RouteEditorModal from '../components/RouteEditorModal';
import TruckFormModal from '../components/TruckFormModal';
import { clearRoutePathsForTruck } from '../utils/routePathCache';
import { useSocketRooms } from '../hooks/useSocketRooms';

export default function DashboardManager() {
  const { user } = useAuth();
  const token = localStorage.getItem('sft_token');
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', truckId: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState([]);
  const [orderCount, setOrderCount] = useState(0);
  const [editingTruck, setEditingTruck] = useState(null); // Route Editor
  const [editingDetails, setEditingDetails] = useState(null); // Details Editor (Create/Edit)
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { api.getManagedTrucks(token).then(d => { if (d.success) setTrucks(d.data); }); }, [token]);

  const handleOrderNew = useCallback(() => setOrderCount(c => c + 1), []);
  const handleTruckDeleted = useCallback(({ truckId }) => {
    if (!truckId) return;
    setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
    setEditingTruck(prev => (prev && (prev.id || prev._id) === truckId ? null : prev));
    setEditingDetails(prev => (prev && (prev.id || prev._id) === truckId ? null : prev));
    clearRoutePathsForTruck(truckId);
  }, []);

  const rooms = useMemo(() => (user?.id ? [`orders:manager:${user.id}`] : []), [user?.id]);
  const listeners = useMemo(() => ({
    'order:new': handleOrderNew,
    'truck:deleted': handleTruckDeleted
  }), [handleOrderNew, handleTruckDeleted]);
  useSocketRooms({ token, rooms, listeners, enabled: Boolean(token) });

  async function submit(e) {
    e.preventDefault(); setError(null); setCreating(true);
    try {
      const data = await api.createStaff(token, form);
      if (data.success) setStaff(s => [...s, data.data]);
      setForm({ name: '', email: '', password: '', truckId: '' });
    } catch (e) { setError(e.message); } finally { setCreating(false); }
  }

  async function handleDeleteTruck(truckId) {
    if (!window.confirm('Are you sure you want to delete this truck?')) return;
    setBusyId(truckId);
    try {
      await api.deleteTruck(token, truckId);
      setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function handleCreateSuccess(newTruck) {
    setTrucks(prev => [...prev, newTruck]);
    setEditingTruck(newTruck);
  }

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>Manager Dashboard</h2>
      </div>

      <div className="card">
        <h3>Create Staff</h3>
        <p style={{ marginBottom: 15, fontSize: 14 }}>Create a new staff account and assign them to one of your trucks.</p>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#475569' }}>
          New orders today: <strong>{orderCount}</strong>
        </div>
        <form onSubmit={submit} className="control-row" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder='Name' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder='Email' type='email' value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input placeholder='Password' type='password' value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <select value={form.truckId} onChange={e => setForm(f => ({ ...f, truckId: e.target.value }))} required>
            <option value=''>Select Truck</option>
            {trucks.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Staff'}
          </button>
        </form>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

        {staff.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 10 }}>Recently Created</h4>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {staff.map(s => <li key={s.id}>{s.email} ({s.role})</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <div>
            <h3 style={{ margin: 0 }}>My Trucks</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Manage your food trucks and their routes.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setEditingDetails({})}>+ Create Truck</button>
        </div>

        <div className="truck-list">
          {trucks.length === 0 && <p style={{ color: '#666' }}>No trucks assigned.</p>}
          {trucks.map(t => (
            <div key={t.id || t._id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0' }}>{t.name}</h4>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Status: <span style={{ fontWeight: 500, color: t.status === 'OPEN' || t.status === 'SERVING' ? 'green' : '#64748b' }}>{t.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ background: '#e2e8f0' }} onClick={() => setEditingDetails(t)}>Edit Details</button>
                <button className="btn btn-secondary" onClick={() => setEditingTruck(t)}>Edit Route</button>
                <button className="btn" style={{ background: '#fee2e2', color: '#dc2626' }} disabled={busyId === (t.id || t._id)} onClick={() => handleDeleteTruck(t.id || t._id)}>
                  {busyId === (t.id || t._id) ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ManagerMenuPanel />

      {editingDetails && (
        (() => {
          const isExisting = Boolean(editingDetails.id || editingDetails._id);
          return (
            <TruckFormModal
              truck={isExisting ? editingDetails : null}
              token={token}
              onClose={() => setEditingDetails(null)}
              onSave={() => api.getManagedTrucks(token).then(d => { if (d.success) setTrucks(d.data); })}
              onSuccess={(newTruck) => !isExisting && handleCreateSuccess(newTruck)}
            />
          );
        })()
      )}

      {editingTruck && (
        <RouteEditorModal
          truck={editingTruck}
          token={token}
          onClose={() => setEditingTruck(null)}
          onSave={() => api.getManagedTrucks(token).then(d => { if (d.success) setTrucks(d.data); })}
        />
      )}
    </div>
  );
}