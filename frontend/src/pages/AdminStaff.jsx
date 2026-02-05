import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AdminStaff() {
  const { token, user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', password:'', truckId:'' });
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const [staffRes, trucksRes] = await Promise.all([
        api.listStaff(token),
        api.getManagedTrucks(token)
      ]);
      if (staffRes.success) setStaff(staffRes.data || []);
      if (trucksRes.success) setTrucks(trucksRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, user]);

  async function submit(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = { name: form.name, email: form.email, password: form.password, truckId: form.truckId };
      const res = await api.createStaff(token, payload);
      if (res.success) {
        setForm({ name:'', email:'', password:'', truckId:'' });
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function assignStaff(id, truckId) {
    if (!truckId) return;
    setBusyId(id);
    setError(null);
    try {
      await api.assignStaffToTruck(token, id, truckId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function unassignStaff(id) {
    setBusyId(id);
    setError(null);
    try {
      await api.unassignStaffFromTruck(token, id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(id, isActive) {
    setBusyId(id);
    setError(null);
    try {
      if (isActive) await api.deactivateStaff(token, id);
      else await api.reactivateStaff(token, id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p className="dashboard-container">Forbidden</p>;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>Admin • Staff Management</h2>
      </div>

      <div className="card">
        <h3>Create Staff</h3>
        <form onSubmit={submit} className="control-row" style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input placeholder="Name" value={form.name} onChange={e=> setForm(f => ({ ...f, name:e.target.value }))} required />
          <input placeholder="Email" type="email" value={form.email} onChange={e=> setForm(f => ({ ...f, email:e.target.value }))} required />
          <input placeholder="Password" type="password" value={form.password} onChange={e=> setForm(f => ({ ...f, password:e.target.value }))} required />
          <select value={form.truckId} onChange={e=> setForm(f => ({ ...f, truckId:e.target.value }))} required>
            <option value="" disabled>Select truck</option>
            {trucks.map(t => (
              <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      </div>

      {loading && <p>Loading staff…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned Truck</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.assignedTruck ? (trucks.find(t => String(t.id || t._id) === String(s.assignedTruck))?.name || s.assignedTruck) : '—'}</td>
                  <td>
                    <span className={`badge ${s.isActive === false ? 'badge-red' : 'badge-green'}`}>
                      {s.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <select
                        style={{ padding:'4px 8px' }}
                        value={s.assignedTruck || ''}
                        onChange={e => assignStaff(s.id, e.target.value)}
                        disabled={busyId === s.id}
                      >
                        <option value="">Unassigned</option>
                        {trucks.map(t => (
                          <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                        ))}
                      </select>
                      {s.assignedTruck && (
                        <button className="btn btn-sm btn-danger" onClick={() => unassignStaff(s.id)} disabled={busyId === s.id}>Unassign</button>
                      )}
                      <button 
                        className={`btn btn-sm ${s.isActive === false ? 'btn-primary' : 'btn-danger'}`}
                        onClick={() => toggleActive(s.id, s.isActive !== false)} 
                        disabled={busyId === s.id}
                      >
                        {s.isActive === false ? 'Reactivate' : 'Deactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign:'center', padding:20 }}>No staff found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
