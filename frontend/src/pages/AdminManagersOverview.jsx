import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AdminManagersOverview(){
  const { user, token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.getManagersOverview(token);
      if (res.success) setData(res.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    let mounted = true;
    (async () => { if (mounted) await load(); })();
    return () => { mounted = false; };
  }, [token, user]);

  async function removeManager(id, nameOrEmail){
    if (!token) return;
    const confirmMsg = `Remove manager ${nameOrEmail}?\nTheir trucks and staff will be temporarily reassigned to you (Admin).`;
    if (!window.confirm(confirmMsg)) return;
    setBusyId(id);
    try {
      const res = await api.deleteManager(token, id);
      if (res.success) {
        await load();
      }
    } catch(e){
      setError(e.message);
    } finally { setBusyId(null); }
  }

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;
  if (loading) return <p style={{ padding:20 }}>Loading...</p>;
  if (error) return <p style={{ padding:20, color:'red' }}>{error}</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
  <h2>Managers Overview</h2>
  <p style={{ fontSize:12, marginTop:-8, color:'#555' }}>Aggregated list of managers, their trucks, staff distribution, and live status.</p>
      {data.length === 0 && <p>No managers found.</p>}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {data.map(m => (
          <div key={m.id} style={{ border:'1px solid #ddd', borderRadius:6, padding:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <strong>{m.name}</strong> <span style={{ color:'#555' }}>({m.email})</span>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ fontSize:12, opacity:0.8 }}>Trucks: {m.truckCount} | Staff: {m.totalStaff}</div>
                <button
                  onClick={() => removeManager(m.id, m.name || m.email)}
                  disabled={busyId === m.id}
                  style={{ background:'#b91c1c', color:'#fff', border:'none', padding:'6px 10px', borderRadius:4, cursor:'pointer' }}
                  title="Remove manager and reassign trucks to Admin"
                >{busyId === m.id ? 'Removing...' : 'Remove'}</button>
              </div>
            </div>
            {m.statusCounts && (
              <div style={{ marginTop:6, fontSize:12, color:'#444' }}>
                Status: {Object.entries(m.statusCounts).map(([k,v]) => `${k}:${v}`).join(' | ') || 'n/a'}
              </div>
            )}
            {m.trucks.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', marginTop:8 }}>
                <thead>
                  <tr>
                    <th style={th}>Truck</th>
                    <th style={th}>Status</th>
                    <th style={th}>Live Location</th>
                    <th style={th}>Staff Count</th>
                    <th style={th}>Staff Members</th>
                  </tr>
                </thead>
                <tbody>
                  {m.trucks.map(t => (
                    <tr key={t.id} style={{ borderTop:'1px solid #eee' }}>
                      <td style={td}>{t.name}</td>
                      <td style={td}>{t.status}</td>
                      <td style={td}>{t.liveLocation ? `${t.liveLocation.lat?.toFixed(3)}, ${t.liveLocation.lng?.toFixed(3)}` : <span style={{ opacity:0.6 }}>—</span>}</td>
                      <td style={td}>{t.staffCount}</td>
                      <td style={td}>{t.staff.length ? t.staff.map(s => s.email).join(', ') : <span style={{ opacity:0.6 }}>None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
