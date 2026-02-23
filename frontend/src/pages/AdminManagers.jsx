import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AdminManagers() {
  const { token, user } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getManagers(token, { includeInactive });
      if (res.success) setManagers(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token, user, includeInactive]);

  async function submit(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await api.createManager(token, form);
      if (res.success) {
        setForm({ name: '', email: '', password: '' });
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function deactivateManager(id, label) {
    if (!window.confirm(`Deactivate manager ${label}? Trucks will be reassigned to you (Admin).`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await api.deleteManager(token, id);
      if (res.success) await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reactivateManager(id) {
    setBusyId(id);
    setError(null);
    try {
      const res = await api.reactivateManager(token, id);
      if (res.success) await load();
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
        <h2>Admin • Managers</h2>
      </div>

      <div className="card">
        <h3>Create Manager</h3>
        <form onSubmit={submit} className="control-row" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
        </form>
      </div>

      <div style={{ margin: '20px 0' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Include inactive
        </label>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading managers…</p>}
      {error && <div style={{ color: 'var(--danger)', padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: 20 }}>{error}</div>}

      {!loading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.map(m => (
                <tr key={m.id}>
                  <td><strong>{m.name || m.email}</strong></td>
                  <td style={{ opacity: 0.7, fontSize: '0.85rem' }}>{m.email}</td>
                  <td>
                    <span className={`badge ${m.isActive === false ? 'badge-gray' : 'badge-green'}`}>
                      {m.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      {m.isActive === false ? (
                        <button className="btn btn-sm btn-primary" onClick={() => reactivateManager(m.id)} disabled={busyId === m.id}>Reactivate</button>
                      ) : (
                        <button className="btn btn-sm btn-danger" onClick={() => deactivateManager(m.id, m.name || m.email)} disabled={busyId === m.id}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {managers.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>No managers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = { textAlign: 'left', padding: 6, background: '#f5f5f5', border: '1px solid #ddd', fontSize: 12 };
const td = { padding: 6, border: '1px solid #eee', fontSize: 13 };
