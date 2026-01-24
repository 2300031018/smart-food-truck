import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function DashboardAdmin(){
  const { user } = useAuth();
  const [form, setForm] = useState({ name:'', email:'', password:'' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState([]);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  async function submit(e){
    e.preventDefault();
    setError(null); setCreating(true);
    try {
      const data = await api.createManager(localStorage.getItem('sft_token'), form);
      if (data.success) setCreated(c => [...c, data.data]);
      setForm({ name:'', email:'', password:'' });
    } catch (e){ setError(e.message); } finally { setCreating(false); }
  }

  async function runCleanup(){
    setCleanupBusy(true);
    setCleanupResult(null);
    setError(null);
    try {
      const token = localStorage.getItem('sft_token');
      const res = await api.cleanupOrphans(token);
      setCleanupResult(res?.data || res);
    } catch (e) {
      setError(e.message);
    } finally {
      setCleanupBusy(false);
    }
  }

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Admin Dashboard</h2>
      <p>Welcome {user?.email}</p>
      <nav style={{ marginTop:8, display:'flex', gap:10 }}>
        <a href="/admin/overview">Managers Overview</a>
        <a href="/admin/managers">Managers (Reactivate/Reassign)</a>
        <a href="/admin/hierarchy">Managers → Trucks → Staff</a>
        <a href="/admin/staff">Manage Staff</a>
      </nav>
      <section style={{ marginTop:24 }}>
        <h3>Create Manager</h3>
        <form onSubmit={submit} style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input placeholder='Name' value={form.name} onChange={e=> setForm(f=>({...f,name:e.target.value}))} required />
          <input placeholder='Email' type='email' value={form.email} onChange={e=> setForm(f=>({...f,email:e.target.value}))} required />
          <input placeholder='Password' type='password' value={form.password} onChange={e=> setForm(f=>({...f,password:e.target.value}))} required />
          <button disabled={creating}>{creating?'Creating...':'Create'}</button>
        </form>
        {error && <div style={{ color:'red' }}>{error}</div>}
        {created.length>0 && <ul style={{ marginTop:12 }}>{created.map(m=> <li key={m.id}>{m.email} ({m.role})</li>)}</ul>}
      </section>
      <section style={{ marginTop:24 }}>
        <h3>Data Maintenance</h3>
        <p>Cleanup orphaned data across the project (admin only).</p>
        <button onClick={runCleanup} disabled={cleanupBusy}>{cleanupBusy ? 'Cleaning…' : 'Cleanup Orphans'}</button>
        {cleanupResult && (
          <pre style={{ background:'#f5f5f5', padding:10, marginTop:10, overflowX:'auto' }}>{JSON.stringify(cleanupResult, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}