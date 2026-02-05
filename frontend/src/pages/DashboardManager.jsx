import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ManagerMenuPanel from '../components/manager/ManagerMenuPanel';

export default function DashboardManager(){
  const { user } = useAuth();
  const token = localStorage.getItem('sft_token');
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState({ name:'', email:'', password:'', truckId:'' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState([]);

  useEffect(()=>{ api.getManagedTrucks(token).then(d=> { if(d.success) setTrucks(d.data); }); },[token]);

  async function submit(e){
    e.preventDefault(); setError(null); setCreating(true);
    try {
      const data = await api.createStaff(token, form);
      if (data.success) setStaff(s => [...s, data.data]);
      setForm({ name:'', email:'', password:'', truckId:'' });
    } catch(e){ setError(e.message); } finally { setCreating(false); }
  }

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>Manager Dashboard</h2>
      </div>

      <div className="card">
        <h3>Create Staff</h3>
        <p style={{ marginBottom: 15, fontSize: 14 }}>Create a new staff account and assign them to one of your trucks.</p>
        <form onSubmit={submit} className="control-row" style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <input placeholder='Name' value={form.name} onChange={e=> setForm(f=>({...f,name:e.target.value}))} required />
          <input placeholder='Email' type='email' value={form.email} onChange={e=> setForm(f=>({...f,email:e.target.value}))} required />
          <input placeholder='Password' type='password' value={form.password} onChange={e=> setForm(f=>({...f,password:e.target.value}))} required />
          <select value={form.truckId} onChange={e=> setForm(f=>({...f,truckId:e.target.value}))} required>
            <option value=''>Select Truck</option>
            {trucks.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Staff'}
          </button>
        </form>
        {error && <div style={{ color:'red', marginTop:10 }}>{error}</div>}
        
        {staff.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 10 }}>Recently Created</h4>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {staff.map(s => <li key={s.id}>{s.email} ({s.role})</li>)}
            </ul>
          </div>
        )}
      </div>

      <ManagerMenuPanel />
    </div>
  );
}