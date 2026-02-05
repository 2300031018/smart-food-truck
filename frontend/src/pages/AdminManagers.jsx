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

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Admin • Managers</h2>

      <section style={{ marginTop:16 }}>
        <h3>Create Manager</h3>
        <form onSubmit={submit} style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input placeholder="Name" value={form.name} onChange={e=> setForm(f => ({ ...f, name:e.target.value }))} required />
          <input placeholder="Email" type="email" value={form.email} onChange={e=> setForm(f => ({ ...f, email:e.target.value }))} required />
          <input placeholder="Password" type="password" value={form.password} onChange={e=> setForm(f => ({ ...f, password:e.target.value }))} required />
          <button disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
        </form>
      </section>

      <section style={{ marginTop:20 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Include inactive
        </label>
      </section>

      {loading && <p>Loading managers…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {managers.map(m => (
              <tr key={m.id} style={{ borderTop:'1px solid #eee' }}>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.email}</td>
                <td style={td}>{m.isActive === false ? 'inactive' : 'active'}</td>
                <td style={td}>
                  {m.isActive === false ? (
                    <button onClick={() => reactivateManager(m.id)} disabled={busyId === m.id}>Reactivate</button>
                  ) : (
                    <button onClick={() => deactivateManager(m.id, m.email)} disabled={busyId === m.id}>Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {managers.length === 0 && (
              <tr><td style={td} colSpan={4}>No managers found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
