import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AdminStaff() {
  const { user, token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});
  const [filter, setFilter] = useState('all'); // all|assigned|unassigned
  const [viewMode, setViewMode] = useState('flat'); // flat | manager
  const [trucks, setTrucks] = useState([]);
  const [moveOpen, setMoveOpen] = useState({}); // staffId -> bool
  const [moveTarget, setMoveTarget] = useState({}); // staffId -> truckId
  const [menuOpen, setMenuOpen] = useState({}); // staffId -> bool

  async function load(){
    setLoading(true); setError(null);
    try {
      const res = await api.listStaff(token);
      if (res.success) setStaff(res.data);
      // Load active trucks for selection
      const trucksRes = await api.getTrucks();
      if (trucksRes.success) setTrucks(trucksRes.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (token && user?.role==='admin') load(); }, [token, user]);

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;

  const truckMap = useMemo(() => {
    const map = new Map();
    (trucks||[]).forEach(t => map.set(t.id, t));
    return map;
  }, [trucks]);

  const filtered = staff.filter(s => {
    if (filter==='assigned') return !!s.assignedTruck;
    if (filter==='unassigned') return !s.assignedTruck;
    return true;
  });

  // Group by manager for hierarchical view
  const groups = useMemo(() => {
    if (viewMode !== 'manager') return [];
    const map = new Map(); // key -> { title, items:[] }
    for (const s of filtered) {
      const key = s.truckManager?.id ? `mgr:${s.truckManager.id}` : 'unassigned';
      if (!map.has(key)) {
        const title = s.truckManager?.id ? `${s.truckManager.name} (${s.truckManager.email})` : 'Unassigned';
        map.set(key, { title, items: [] });
      }
      map.get(key).items.push(s);
    }
    // Sort groups: managers alphabetically, unassigned last
    const entries = Array.from(map.entries());
    entries.sort((a,b) => {
      if (a[0] === 'unassigned') return 1;
      if (b[0] === 'unassigned') return -1;
      return a[1].title.localeCompare(b[1].title);
    });
    return entries.map(([key, val]) => ({ key, ...val }));
  }, [filtered, viewMode]);

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <h2>Admin • Staff Management</h2>
        <div style={{ display:'flex', gap:8 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span>View:</span>
            <select value={viewMode} onChange={e=>setViewMode(e.target.value)}>
              <option value="flat">Flat</option>
              <option value="manager">By Manager</option>
            </select>
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span>Filter:</span>
            <select value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
        </div>
      </div>

      {loading && <p>Loading staff…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && viewMode === 'flat' && (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Truck</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td style={td}>{s.name}</td>
                <td style={td}>{s.email}</td>
                <td style={td}>
                  {s.assignedTruck ? (
                    (()=>{
                      const t = truckMap.get(String(s.assignedTruck));
                      // In flat view we can show the shortId to disambiguate
                      return t ? `${t.name} (${shortId(t.id)})` : String(s.assignedTruck);
                    })()
                  ) : '—'}
                </td>
                <td style={{ ...td, position:'relative' }}>
                  {!moveOpen[s.id] ? (
                    <>
                      <button style={btn} onClick={()=> setMenuOpen(m => ({ ...m, [s.id]: !m[s.id] }))}>Manage ▾</button>
                      {menuOpen[s.id] && (
                        <div style={menuBox}>
                          <button style={menuItem} onClick={()=> { setMoveOpen(o => ({ ...o, [s.id]: true })); setMenuOpen(m => ({ ...m, [s.id]: false })); }}>Assign/Move…</button>
                          {s.assignedTruck && (
                            <button style={menuItem} disabled={!!busy[`un:${s.id}`]} onClick={async()=>{
                              setMenuOpen(m => ({ ...m, [s.id]: false }));
                              setBusy(b => ({ ...b, [`un:${s.id}`]: true }));
                              try { await api.unassignStaffFromTruck(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`un:${s.id}`]: false })); }
                            }}>Unassign</button>
                          )}
                          {s.isActive ? (
                            <button style={menuItem} disabled={!!busy[`de:${s.id}`]} onClick={async()=>{
                              setMenuOpen(m => ({ ...m, [s.id]: false }));
                              setBusy(b => ({ ...b, [`de:${s.id}`]: true }));
                              try { await api.deactivateStaff(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`de:${s.id}`]: false })); }
                            }}>Deactivate</button>
                          ) : (
                            <button style={menuItem} disabled={!!busy[`re:${s.id}`]} onClick={async()=>{
                              setMenuOpen(m => ({ ...m, [s.id]: false }));
                              setBusy(b => ({ ...b, [`re:${s.id}`]: true }));
                              try { await api.reactivateStaff(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`re:${s.id}`]: false })); }
                            }}>Reactivate</button>
                          )}
                          <button style={{ ...menuItem, color:'#b00020' }} disabled={!!busy[`del:${s.id}`]} onClick={async()=>{
                            setMenuOpen(m => ({ ...m, [s.id]: false }));
                            if (!confirm(`Delete staff ${s.name} (${s.email})? This cannot be undone.`)) return;
                            setBusy(b => ({ ...b, [`del:${s.id}`]: true }));
                            try { await api.deleteStaff(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`del:${s.id}`]: false })); }
                          }}>Delete</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <span>
                      <select value={moveTarget[s.id]||''} onChange={e=> setMoveTarget(m => ({ ...m, [s.id]: e.target.value }))}>
                        <option value="" disabled>Select Truck</option>
                        {trucks.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({shortId(t.id)})</option>
                        ))}
                      </select>
                      <button style={btn} disabled={!!busy[`mv:${s.id}`] || !moveTarget[s.id]} onClick={async()=>{
                        const truckId = moveTarget[s.id];
                        if (!truckId) return;
                        setBusy(b => ({ ...b, [`mv:${s.id}`]: true }));
                        try { await api.assignStaffToTruck(token, s.id, truckId); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`mv:${s.id}`]: false })); setMoveOpen(o => ({ ...o, [s.id]: false })); setMoveTarget(m => ({ ...m, [s.id]: '' })); }
                      }}>Apply</button>
                      <button style={btn} onClick={()=> { setMoveOpen(o => ({ ...o, [s.id]: false })); setMoveTarget(m => ({ ...m, [s.id]: '' })); }}>Cancel</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && viewMode === 'manager' && (
        <div style={{ marginTop: 12 }}>
          {groups.length === 0 ? (
            <div style={{ color:'#666' }}>No staff match the selected filter.</div>
          ) : (
            groups.map(group => (
              <div key={group.key} style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '16px 0 8px', display:'flex', alignItems:'center', gap:8 }} title={group.title}>
                  <span>{group.title.split(' (')[0]}</span>
                  <span style={badge}>Staff: {group.items.length}</span>
                </h3>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Name</th>
                      <th style={th}>Email</th>
                      <th style={th}>Truck</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(s => (
                      <tr key={s.id}>
                        <td style={td}>{s.name}</td>
                        <td style={td}>{s.email}</td>
                        <td style={td}>
                          {s.assignedTruck ? (
                            (()=>{
                              const t = truckMap.get(String(s.assignedTruck));
                              // In manager view, avoid repeating the shortId noise; show just the name
                              return t ? `${t.name}` : String(s.assignedTruck);
                            })()
                          ) : '—'}
                        </td>
                        <td style={{ ...td, position:'relative' }}>
                          {!moveOpen[s.id] ? (
                            <>
                              <button style={btn} onClick={()=> setMenuOpen(m => ({ ...m, [s.id]: !m[s.id] }))}>Manage ▾</button>
                              {menuOpen[s.id] && (
                                <div style={menuBox}>
                                  <button style={menuItem} onClick={()=> { setMoveOpen(o => ({ ...o, [s.id]: true })); setMenuOpen(m => ({ ...m, [s.id]: false })); }}>Assign/Move…</button>
                                  {s.assignedTruck && (
                                    <button style={menuItem} disabled={!!busy[`un:${s.id}`]} onClick={async()=>{
                                      setMenuOpen(m => ({ ...m, [s.id]: false }));
                                      setBusy(b => ({ ...b, [`un:${s.id}`]: true }));
                                      try { await api.unassignStaffFromTruck(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`un:${s.id}`]: false })); }
                                    }}>Unassign</button>
                                  )}
                                  {s.isActive ? (
                                    <button style={menuItem} disabled={!!busy[`de:${s.id}`]} onClick={async()=>{
                                      setMenuOpen(m => ({ ...m, [s.id]: false }));
                                      setBusy(b => ({ ...b, [`de:${s.id}`]: true }));
                                      try { await api.deactivateStaff(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`de:${s.id}`]: false })); }
                                    }}>Deactivate</button>
                                  ) : (
                                    <button style={menuItem} disabled={!!busy[`re:${s.id}`]} onClick={async()=>{
                                      setMenuOpen(m => ({ ...m, [s.id]: false }));
                                      setBusy(b => ({ ...b, [`re:${s.id}`]: true }));
                                      try { await api.reactivateStaff(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`re:${s.id}`]: false })); }
                                    }}>Reactivate</button>
                                  )}
                                  <button style={{ ...menuItem, color:'#b00020' }} disabled={!!busy[`del:${s.id}`]} onClick={async()=>{
                                    setMenuOpen(m => ({ ...m, [s.id]: false }));
                                    if (!confirm(`Delete staff ${s.name} (${s.email})? This cannot be undone.`)) return;
                                    setBusy(b => ({ ...b, [`del:${s.id}`]: true }));
                                    try { await api.deleteStaff(token, s.id); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`del:${s.id}`]: false })); }
                                  }}>Delete</button>
                                </div>
                              )}
                            </>
                          ) : (
                            <span>
                              <select value={moveTarget[s.id]||''} onChange={e=> setMoveTarget(m => ({ ...m, [s.id]: e.target.value }))}>
                                <option value="" disabled>Select Truck</option>
                                {trucks.map(t => (
                                  <option key={t.id} value={t.id}>{t.name} ({shortId(t.id)})</option>
                                ))}
                              </select>
                              <button style={btn} disabled={!!busy[`mv:${s.id}`] || !moveTarget[s.id]} onClick={async()=>{
                                const truckId = moveTarget[s.id];
                                if (!truckId) return;
                                setBusy(b => ({ ...b, [`mv:${s.id}`]: true }));
                                try { await api.assignStaffToTruck(token, s.id, truckId); await load(); } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`mv:${s.id}`]: false })); setMoveOpen(o => ({ ...o, [s.id]: false })); setMoveTarget(m => ({ ...m, [s.id]: '' })); }
                              }}>Apply</button>
                              <button style={btn} onClick={()=> { setMoveOpen(o => ({ ...o, [s.id]: false })); setMoveTarget(m => ({ ...m, [s.id]: '' })); }}>Cancel</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const th = { textAlign:'left', padding:8, background:'#f5f5f5', border:'1px solid #ddd' };
const td = { padding:8, border:'1px solid #eee' };
const btn = { padding:'4px 8px', marginRight:6 };
const badge = { background:'#eef2ff', color:'#3730a3', border:'1px solid #c7d2fe', borderRadius:12, fontSize:12, padding:'2px 8px' };
const menuBox = { position:'absolute', zIndex:10, background:'#fff', border:'1px solid #ddd', borderRadius:6, boxShadow:'0 4px 10px rgba(0,0,0,0.06)', padding:6, display:'flex', flexDirection:'column', minWidth:160 };
const menuItem = { textAlign:'left', padding:'6px 8px', background:'transparent', border:'none', cursor:'pointer' };

function shortId(id){ return String(id).slice(0,6); }
