import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AdminManagers(){
  const { user, token } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [managers, setManagers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [targetManagerId, setTargetManagerId] = useState('');
  const [selection, setSelection] = useState({}); // truckId => boolean
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [excludeTargetManaged, setExcludeTargetManaged] = useState(true);

  // After MVP simplification, we only use `isActive` to differentiate manager state
  const inactiveManagers = useMemo(() => managers.filter(m => m.isActive === false), [managers]);
  const activeManagers = useMemo(() => managers.filter(m => m.isActive !== false), [managers]);

  async function load(){
    if (!token || user?.role !== 'admin') return;
    setLoading(true); setError(null);
    try {
      const [mgrRes, trucksRes] = await Promise.all([
        api.getManagers(token, { includeInactive }),
        api.getManagedTrucks(token)
      ]);
      if (mgrRes.success) setManagers(mgrRes.data);
      if (trucksRes.success) setTrucks(trucksRes.data || trucksRes.trucks || []);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token, user, includeInactive]);

  function toggleTruckSelection(id){
    setSelection(s => ({ ...s, [id]: !s[id] }));
  }

  function isManagedByTarget(truck){
    if (!targetManagerId) return false;
    const mgr = truck.manager;
    if (!mgr) return false;
    const mgrId = (typeof mgr === 'object') ? (mgr.id || mgr._id) : mgr;
    return String(mgrId) === String(targetManagerId);
  }

  const visibleTrucks = useMemo(() => {
    if (excludeTargetManaged && targetManagerId){
      return trucks.filter(t => !isManagedByTarget(t));
    }
    return trucks;
  }, [trucks, excludeTargetManaged, targetManagerId]);

  // Keep selection consistent with the visible set to avoid selecting hidden rows
  useEffect(() => {
    setSelection(prev => {
      const allowed = new Set(visibleTrucks.map(t => String(t.id || t._id)));
      const next = {};
      for (const [k,v] of Object.entries(prev)){
        if (allowed.has(String(k))) next[k] = v;
      }
      return next;
    });
  }, [visibleTrucks]);

  function selectAll(value){
    const map = {};
    for (const t of visibleTrucks){ map[t.id || t._id] = value; }
    setSelection(map);
  }

  async function reactivateManager(id){
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const res = await api.reactivateManager(token, id);
      if (res.success) await load();
    } catch(e){ setError(e.message); }
    finally { setBusy(false); }
  }

  async function bulkReassign(){
    if (!token) return;
    const chosen = Object.entries(selection).filter(([,v]) => v).map(([k]) => k);
    if (chosen.length === 0) { alert('Select at least one truck.'); return; }
    if (!targetManagerId) { alert('Choose target manager.'); return; }
    if (!window.confirm(`Reassign ${chosen.length} truck(s) to selected manager?`)) return;
    setBusy(true); setError(null);
    try {
      // Use per-truck assignManager endpoint
      for (const truckId of chosen){
        await api.assignManager(token, truckId, targetManagerId);
      }
      await load();
      setSelection({});
    } catch(e){ setError(e.message); }
    finally { setBusy(false); }
  }

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Managers (Admin)</h2>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:8 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type="checkbox" checked={includeInactive} onChange={(e)=> setIncludeInactive(e.target.checked)} />
          Include inactive
        </label>
        {loading && <span>Loading...</span>}
        {error && <span style={{ color:'red' }}>{error}</span>}
      </div>

      {/* Inactive managers with Reactivate action */}
      {includeInactive && (
        <section style={{ marginTop:20 }}>
          <h3>Inactive Managers</h3>
          {inactiveManagers.length === 0 ? (
            <p style={{ opacity:0.7 }}>None</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {inactiveManagers.map(m => (
                <div key={m.id} style={{ border:'1px solid #ddd', borderRadius:6, padding:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <strong>{m.name}</strong> <span style={{ color:'#555' }}>({m.email})</span>
                    <span style={{ marginLeft:8, fontSize:12, color:'#a00' }}>[inactive]</span>
                  </div>
                  <button disabled={busy} onClick={() => reactivateManager(m.id)} style={{ padding:'6px 10px' }}>Reactivate</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Bulk reassign trucks */}
      <section style={{ marginTop:24 }}>
        <h3>Bulk Reassign Trucks to Manager</h3>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <label>
            Target manager:
            <select value={targetManagerId} onChange={(e)=> setTargetManagerId(e.target.value)} style={{ marginLeft:8 }}>
              <option value="">-- select --</option>
              {activeManagers.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
              ))}
            </select>
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={excludeTargetManaged} onChange={(e)=> setExcludeTargetManaged(e.target.checked)} />
            Hide trucks already assigned to target manager
          </label>
          <button disabled={busy} onClick={() => selectAll(true)}>Select all</button>
          <button disabled={busy} onClick={() => selectAll(false)}>Clear</button>
          <button disabled={busy} onClick={bulkReassign}>Reassign Selected</button>
        </div>
        <div style={{ marginTop:10, border:'1px solid #eee', borderRadius:6 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Select</th>
                <th style={th}>Truck</th>
                <th style={th}>Current Manager</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrucks.map(t => {
                const id = t.id || t._id;
                const mgr = t.manager ? (t.manager.name ? `${t.manager.name} (${t.manager.email})` : t.manager.email || '—') : '—';
                const disabled = targetManagerId && isManagedByTarget(t);
                return (
                  <tr key={id} style={{ borderTop:'1px solid #f0f0f0', opacity: disabled ? 0.6 : 1 }}>
                    <td style={td}><input type="checkbox" checked={!!selection[id]} onChange={() => toggleTruckSelection(id)} disabled={disabled} /></td>
                    <td style={td}>{t.name}</td>
                    <td style={td}>{mgr}</td>
                    <td style={td}>{t.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
