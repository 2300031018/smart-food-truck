import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { managerApi } from '../api/client';

export default function ManagerStaff(){
  const { user, token } = useAuth();
  const [staff, setStaff] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});
  const [filterTruck, setFilterTruck] = useState('all');
  // viewFilter controls which dataset is shown: active staff (assigned/unassigned) or previously-managed reclaim list
  const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'reclaim'
  // uiState per-person: { open: boolean, target: truckId }
  const [uiState, setUiState] = useState({});
  const [menuOpen, setMenuOpen] = useState({}); // staffId -> boolean
  const [reclaim, setReclaim] = useState([]);

  useEffect(()=>{
    if (!token || user?.role !== 'manager') return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      managerApi.listStaff(token),
      managerApi.getManagedTrucks(token),
      managerApi.reclaimUnassigned(token)
    ]).then(([staffRes, trucksRes, reclaimRes]) => {
      if (!mounted) return;
      if (staffRes.success) setStaff(staffRes.data);
      if (trucksRes.success) setTrucks(trucksRes.data);
      if (reclaimRes && reclaimRes.success) setReclaim(reclaimRes.data);
    }).catch(e => setError(e.message)).finally(()=> setLoading(false));
    return ()=> { mounted = false; };
  }, [token, user]);

  const truckMap = useMemo(()=>{
    const m = new Map();
    (trucks||[]).forEach(t => m.set(t._id || t.id, t));
    return m;
  }, [trucks]);

  // Determine the dataset to render based on viewFilter
  const dataset = viewFilter === 'reclaim' ? reclaim : staff;
  const filtered = dataset.filter(s => {
    if (viewFilter === 'reclaim') return true; // truck filter not applicable to reclaim list
    if (filterTruck === 'all') return true;
    return String(s.assignedTruck||'') === String(filterTruck);
  });

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'manager') return <p style={{ padding:20 }}>Forbidden</p>;
  if (loading) return <p style={{ padding:20 }}>Loading…</p>;
  if (error) return <p style={{ padding:20, color:'red' }}>{error}</p>;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>My Staff</h2>
      </div>

      <div className="card" style={{ display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
        <div>
          <label style={{ marginRight:8, fontWeight:500 }}>View:</label>
          <select value={viewFilter} onChange={e=> setViewFilter(e.target.value)}>
            <option value="active">Active Staff</option>
            <option value="reclaim">Previously Managed (Reclaim)</option>
          </select>
        </div>
        {viewFilter === 'active' && (
          <div>
            <label style={{ marginRight:8, fontWeight:500 }}>Filter by Truck:</label>
            <select value={filterTruck} onChange={e=> setFilterTruck(e.target.value)}>
              <option value="all">All Trucks</option>
              {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Assigned Truck</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const id = s.id;
              const assigned = !!s.assignedTruck;
              const open = !!uiState[id]?.open;
              const target = uiState[id]?.target || '';
              return (
                <tr key={id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{s.name}</div>
                    <div style={{ fontSize:13, color:'#6b7280' }}>{s.email}</div>
                  </td>
                  <td>
                    {assigned ? (
                      <span className="badge badge-green">
                        {truckMap.get(String(s.assignedTruck))?.name || 'Unknown Truck'}
                      </span>
                    ) : (
                      <span className="badge badge-yellow">Unassigned</span>
                    )}
                  </td>
                  <td style={{ position:'relative' }}>
                    {viewFilter === 'reclaim' || !assigned ? (
                      // Unassigned or reclaim: show Assign action only
                    !open ? (
                      <>
                        <button style={btn} onClick={()=> setMenuOpen(m => ({ ...m, [id]: !m[id] }))}>Assign ▾</button>
                        {menuOpen[id] && (
                          <div style={menuBox}>
                            <button style={menuItem} onClick={()=> { setUiState(u => ({ ...u, [id]: { open:true, target:'' } })); setMenuOpen(m => ({ ...m, [id]: false })); }}>Assign to truck…</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <span>
                        <select value={target} onChange={e=> setUiState(u => ({ ...u, [id]: { ...(u[id]||{}), target: e.target.value } }))}>
                          <option value="" disabled>Select Truck</option>
                          {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                        </select>
                        <button style={btn} disabled={!!busy[`as:${id}`] || !target} onClick={async()=>{
                          if (!target) return;
                          setBusy(b => ({ ...b, [`as:${id}`]: true }));
                          try {
                            await managerApi.assignStaffToManagedTruck(token, target, id);
                            if (viewFilter === 'reclaim') {
                              setStaff(list => {
                                const exists = list.some(it => it.id === id);
                                const recEntry = { id, name: s.name, email: s.email, assignedTruck: target };
                                return exists ? list.map(it => it.id === id ? recEntry : it) : [...list, recEntry];
                              });
                              setReclaim(r => r.filter(it => it.id !== id));
                            } else {
                              setStaff(list => list.map(it => it.id === id ? { ...it, assignedTruck: target } : it));
                              setReclaim(r => r.filter(it => it.id !== id));
                            }
                            setUiState(u => ({ ...u, [id]: { open:false, target:'' } }));
                          } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`as:${id}`]: false })); }
                        }}>Assign</button>
                        <button style={btn} onClick={()=> setUiState(u => ({ ...u, [id]: { open:false, target:'' } }))}>Cancel</button>
                      </span>
                    )
                  ) : (
                    // Assigned: Manage dropdown groups Move and Unassign
                    !open ? (
                      <>
                        <button style={btn} onClick={()=> setMenuOpen(m => ({ ...m, [id]: !m[id] }))}>Manage ▾</button>
                        {menuOpen[id] && (
                          <div style={menuBox}>
                            <button style={menuItem} onClick={()=> { setUiState(u => ({ ...u, [id]: { open:true, target:'' } })); setMenuOpen(m => ({ ...m, [id]: false })); }}>Move…</button>
                            <button style={menuItem} disabled={!!busy[`un:${id}`]} onClick={async()=>{
                              setMenuOpen(m => ({ ...m, [id]: false }));
                              const truckId = String(s.assignedTruck);
                              setBusy(b => ({ ...b, [`un:${id}`]: true }));
                              try {
                                await managerApi.unassignStaffFromManagedTruck(token, truckId, id);
                                setStaff(list => list.map(it => it.id === id ? { ...it, assignedTruck: undefined } : it));
                                setReclaim(r => r.some(u => u.id === id) ? r : [...r, { id, name: s.name, email: s.email }]);
                                setUiState(u => ({ ...u, [id]: { open:false, target:'' } }));
                              } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`un:${id}`]: false })); }
                            }}>Unassign</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <span>
                        <select value={target} onChange={e=> setUiState(u => ({ ...u, [id]: { ...(u[id]||{}), target: e.target.value } }))}>
                          <option value="" disabled>Move to…</option>
                          {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                        </select>
                        <button style={btn} disabled={!!busy[`mv:${id}`] || !target} onClick={async()=>{
                          if (!target) return;
                          setBusy(b => ({ ...b, [`mv:${id}`]: true }));
                          try {
                            await managerApi.assignStaffToManagedTruck(token, target, id);
                            setStaff(list => list.map(it => it.id === id ? { ...it, assignedTruck: target } : it));
                            setUiState(u => ({ ...u, [id]: { open:false, target:'' } }));
                          } catch(e){ alert(e.message); } finally { setBusy(b => ({ ...b, [`mv:${id}`]: false })); }
                        }}>Apply</button>
                        <button style={btn} onClick={()=> setUiState(u => ({ ...u, [id]: { open:false, target:'' } }))}>Close</button>
                      </span>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const th = { textAlign:'left', padding:8, background:'#f5f5f5', border:'1px solid #ddd' };
const td = { padding:8, border:'1px solid #eee' };
const btn = { padding:'4px 8px', marginRight:6 };
const menuBox = { position:'absolute', zIndex:10, background:'#fff', border:'1px solid #ddd', borderRadius:6, boxShadow:'0 4px 10px rgba(0,0,0,0.06)', padding:6, display:'flex', flexDirection:'column', minWidth:160 };
const menuItem = { textAlign:'left', padding:'6px 8px', background:'transparent', border:'none', cursor:'pointer' };
