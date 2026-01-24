import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function AdminHierarchy() {
  const { user, token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [busy, setBusy] = useState({}); // action key -> bool
  const [trucks, setTrucks] = useState([]);
  const [moveUi, setMoveUi] = useState({}); // staffId -> { open:boolean, target:'' }
  const [managers, setManagers] = useState([]); // for assigning manager without typing IDs
  const [assignUi, setAssignUi] = useState({}); // truckId -> { open:boolean, managerId:'' }
  const [statusUi, setStatusUi] = useState({}); // truckId -> { open:boolean, status:'' }
  const [moveTruckUi, setMoveTruckUi] = useState({}); // truckId -> { open:boolean, staffId:'', target:'' }

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      api.getManagersHierarchy(token, { includeInactive }),
      api.getTrucks(),
      api.getManagers(token)
    ])
      .then(([hier, trucksRes, mgrs]) => {
        if (mounted) {
          if (hier.success) setData(hier.data);
          if (trucksRes.success) setTrucks(trucksRes.data);
          if (mgrs.success) setManagers(mgrs.data);
        }
      })
      .catch(e => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, user, includeInactive]);

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const setActionBusy = (k, v) => setBusy(prev => ({ ...prev, [k]: v }));

  const totals = useMemo(() => {
    const trucks = data.reduce((acc,m)=>acc + (m.totals?.trucks||0),0);
    const staff = data.reduce((acc,m)=>acc + (m.totals?.staff||0),0);
    return { trucks, staff, managers: data.length };
  }, [data]);

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;
  if (loading) return <p style={{ padding:20 }}>Loading hierarchy…</p>;
  if (error) return <p style={{ padding:20, color:'red' }}>{error}</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ marginBottom:4 }}>Managers → Trucks → Staff</h2>
          <div style={{ color:'#555', fontSize:12 }}>Managers: {totals.managers} | Trucks: {totals.trucks} | Staff: {totals.staff}</div>
        </div>
        <label style={{ fontSize:13 }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} /> Include inactive
        </label>
      </div>

      <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:12 }}>
        {data.map(m => (
          <div key={m.id} style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <button onClick={()=>toggle(m.id)} style={btnSm}>{expanded[m.id] ? '▾' : '▸'}</button>
              <div style={{ flex:1 }}>
                <strong>{m.name}</strong> <span style={{ color:'#555' }}>({m.email})</span>
                <div style={{ fontSize:12, color:'#666' }}>Trucks: {m.totals?.trucks||0} | Staff: {m.totals?.staff||0} | Last active: {formatTS(m.lastLoginAt)}</div>
                {m.statusCounts && <div style={{ fontSize:12, color:'#666' }}>Status: {Object.entries(m.statusCounts).map(([k,v])=>`${k}:${v}`).join(' | ')||'n/a'}</div>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {/* Future: Reactivate/deactivate manager inline */}
              </div>
            </div>
            {expanded[m.id] && (
              <div style={{ marginTop:10, marginLeft:24, display:'flex', flexDirection:'column', gap:8 }}>
                {m.trucks?.length ? m.trucks.map(t => (
                  <div key={t.id} style={{ border:'1px solid #eee', borderRadius:6, padding:10 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <button onClick={()=>toggle(t.id)} style={btnSm}>{expanded[t.id] ? '▾' : '▸'}</button>
                      <div style={{ flex:1 }}>
                        <div><strong>{t.name}</strong> <span style={{ color:'#777' }}>({t.status})</span></div>
                        <div style={{ fontSize:12, color:'#666' }}>Loc: {t.liveLocation ? `${t.liveLocation.lat?.toFixed(3)}, ${t.liveLocation.lng?.toFixed(3)}` : '—'} | Staff: {t.staffCount}</div>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        {!assignUi[t.id]?.open ? (
                          <InlineAction label="Assign Manager" busy={false} onClick={()=> setAssignUi(u => ({ ...u, [t.id]: { open:true, managerId:'' } }))} />
                        ) : (
                          <span>
                            <select value={assignUi[t.id]?.managerId||''} onChange={e=> setAssignUi(u=> ({ ...u, [t.id]: { ...(u[t.id]||{}), managerId:e.target.value } }))}>
                              <option value="" disabled>Select manager</option>
                              {managers.map(mgr => (
                                <option key={mgr.id} value={mgr.id}>{mgr.name || mgr.email} ({shortId(mgr.id)})</option>
                              ))}
                            </select>
                            <InlineAction label="Apply" busy={busy[`am:${t.id}`]} onClick={async()=>{
                              const managerId = assignUi[t.id]?.managerId; if (!managerId) return;
                              setActionBusy(`am:${t.id}`, true);
                              try { await apiRequest(() => api.assignManager(token, t.id, managerId)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`am:${t.id}`, false); setAssignUi(u => ({ ...u, [t.id]: { open:false, managerId:'' } })); }
                            }} />
                            <InlineAction label="Cancel" onClick={()=> setAssignUi(u => ({ ...u, [t.id]: { open:false, managerId:'' } }))} />
                          </span>
                        )}
                        <InlineAction label="Unassign Manager" busy={busy[`um:${t.id}`]} onClick={async()=>{
                          setActionBusy(`um:${t.id}`, true);
                          try { await apiRequest(() => api.unassignManager(token, t.id)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`um:${t.id}`, false); }
                        }} />
                        {!statusUi[t.id]?.open ? (
                          <InlineAction label="Set Status" busy={false} onClick={()=> setStatusUi(u => ({ ...u, [t.id]: { open:true, status:t.status||'' } }))} />
                        ) : (
                          <span>
                            <select value={statusUi[t.id]?.status||''} onChange={e=> setStatusUi(u => ({ ...u, [t.id]: { ...(u[t.id]||{}), status: e.target.value } }))}>
                              <option value="" disabled>Select status</option>
                              {['open','closed','in-transit','maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <InlineAction label="Apply" busy={busy[`st:${t.id}`]} onClick={async()=>{
                              const status = statusUi[t.id]?.status; if (!status) return;
                              setActionBusy(`st:${t.id}`, true);
                              try { await apiRequest(() => api.updateTruckStatusLocation(token, t.id, { status })); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`st:${t.id}`, false); setStatusUi(u => ({ ...u, [t.id]: { open:false, status:'' } })); }
                            }} />
                            <InlineAction label="Cancel" onClick={()=> setStatusUi(u => ({ ...u, [t.id]: { open:false, status:'' } }))} />
                          </span>
                        )}
                        {!moveTruckUi[t.id]?.open ? (
                          <InlineAction label="Move Staff" busy={false} onClick={()=> setMoveTruckUi(u => ({ ...u, [t.id]: { open:true, staffId:'', target:'' } }))} />
                        ) : (
                          <span>
                            <select value={moveTruckUi[t.id]?.staffId||''} onChange={e=> setMoveTruckUi(u => ({ ...u, [t.id]: { ...(u[t.id]||{}), staffId:e.target.value } }))}>
                              <option value="" disabled>Select staff</option>
                              {(t.staff||[]).map(s => (
                                <option key={s.id} value={s.id}>{s.name || s.email} ({shortId(s.id)})</option>
                              ))}
                            </select>
                            <select value={moveTruckUi[t.id]?.target||''} onChange={e=> setMoveTruckUi(u => ({ ...u, [t.id]: { ...(u[t.id]||{}), target:e.target.value } }))}>
                              <option value="" disabled>Select target truck</option>
                              {trucks.filter(tr => tr.id !== t.id).map(tr => (
                                <option key={tr.id} value={tr.id}>{tr.name} ({shortId(tr.id)})</option>
                              ))}
                            </select>
                            <InlineAction label="Apply" busy={busy[`mv:${t.id}`]} onClick={async()=>{
                              const staffId = moveTruckUi[t.id]?.staffId; const targetTruckId = moveTruckUi[t.id]?.target; if (!staffId || !targetTruckId) return;
                              setActionBusy(`mv:${t.id}`, true);
                              try { await apiRequest(() => api.assignStaffToTruck(token, staffId, targetTruckId)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`mv:${t.id}`, false); setMoveTruckUi(u => ({ ...u, [t.id]: { open:false, staffId:'', target:'' } })); }
                            }} />
                            <InlineAction label="Cancel" onClick={()=> setMoveTruckUi(u => ({ ...u, [t.id]: { open:false, staffId:'', target:'' } }))} />
                          </span>
                        )}
                      </div>
                    </div>
                    {expanded[t.id] && (
                      <div style={{ marginTop:8, marginLeft:24 }}>
                        {t.staff?.length ? (
                          <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                              <tr>
                                <th style={th}>Name</th>
                                <th style={th}>Email</th>
                                <th style={th}>Role</th>
                                <th style={th}>Last active</th>
                                <th style={th}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.staff.map(s => (
                                <tr key={s.id}>
                                  <td style={td}>{s.name}</td>
                                  <td style={td}>{s.email}</td>
                                  <td style={td}>{s.staffRole||'general'}</td>
                                  <td style={td}>{formatTS(s.lastLoginAt)}</td>
                                  <td style={td}>
                                    <InlineAction label="Unassign" busy={busy[`us:${t.id}:${s.id}`]} onClick={async()=>{
                                      setActionBusy(`us:${t.id}:${s.id}`, true);
                                      try { await apiRequest(() => api.unassignStaff(token, t.id, s.id)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`us:${t.id}:${s.id}`, false); }
                                    }} />
                                    {!moveUi[s.id]?.open ? (
                                      <InlineAction label="Move" busy={false} onClick={()=> setMoveUi(m => ({ ...m, [s.id]: { open:true, target:'' } }))} />
                                    ) : (
                                      <span>
                                        <select value={moveUi[s.id]?.target||''} onChange={e=> setMoveUi(m => ({ ...m, [s.id]: { ...(m[s.id]||{}), target: e.target.value } }))}>
                                          <option value="" disabled>Select Truck</option>
                                          {trucks.map(tr => (
                                            <option key={tr.id} value={tr.id}>{tr.name} ({shortId(tr.id)})</option>
                                          ))}
                                        </select>
                                        <InlineAction label="Apply" busy={busy[`ms:${t.id}:${s.id}`]} onClick={async()=>{
                                          const targetTruckId = moveUi[s.id]?.target;
                                          if (!targetTruckId) return;
                                          setActionBusy(`ms:${t.id}:${s.id}`, true);
                                          try { await apiRequest(() => api.assignStaffToTruck(token, s.id, targetTruckId)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`ms:${t.id}:${s.id}`, false); setMoveUi(m => ({ ...m, [s.id]: { open:false, target:'' } })); }
                                        }} />
                                        <InlineAction label="Cancel" onClick={()=> setMoveUi(m => ({ ...m, [s.id]: { open:false, target:'' } }))} />
                                      </span>
                                    )}
                                    <InlineAction label="Deactivate" busy={busy[`ds:${s.id}`]} onClick={async()=>{
                                      setActionBusy(`ds:${s.id}`, true);
                                      try { await apiRequest(() => api.deactivateStaff(token, s.id)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`ds:${s.id}`, false); }
                                    }} />
                                    <InlineAction label="Reactivate" busy={busy[`rs:${s.id}`]} onClick={async()=>{
                                      setActionBusy(`rs:${s.id}`, true);
                                      try { await apiRequest(() => api.reactivateStaff(token, s.id)); await refresh(setLoading, token, includeInactive, setData); } catch(e){ alert(e.message); } finally { setActionBusy(`rs:${s.id}`, false); }
                                    }} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ color:'#777' }}>No staff.</div>
                        )}
                      </div>
                    )}
                  </div>
                )) : <div style={{ color:'#777' }}>No trucks.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTS(ts) { if (!ts) return '—'; try { return new Date(ts).toLocaleString(); } catch { return '—'; } }

function InlineAction({ label, onClick, busy }) {
  return <button disabled={busy} onClick={onClick} style={btnAction}>{busy ? '…' : label}</button>;
}

async function apiRequest(fn) {
  const res = await fn();
  if (res && res.success === false) throw new Error(res.error?.message||'Request failed');
  return res;
}

async function refresh(setLoading, token, includeInactive, setData) {
  setLoading(true);
  try {
    const res = await api.getManagersHierarchy(token, { includeInactive });
    if (res.success) setData(res.data);
  } finally {
    setLoading(false);
  }
}
const btnSm = { padding:'2px 6px', fontSize:12 };
const btnAction = { padding:'4px 8px', fontSize:12, border:'1px solid #ccc', borderRadius:4, background:'#fafafa', cursor:'pointer' };
const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd', fontSize:12 };
const td = { padding:6, border:'1px solid #eee', fontSize:13 };
