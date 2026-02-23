import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { managerApi } from '../api/client';

export default function ManagerStaff() {
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
  const [editingStaff, setEditingStaff] = useState(null); // { id, name, staffRole }
  const [editForm, setEditForm] = useState({ name: '', staffRole: '' });

  useEffect(() => {
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
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [token, user]);

  const truckMap = useMemo(() => {
    const m = new Map();
    (trucks || []).forEach(t => m.set(t._id || t.id, t));
    return m;
  }, [trucks]);

  // Determine the dataset to render based on viewFilter
  const dataset = viewFilter === 'reclaim' ? reclaim : staff;
  const filtered = dataset.filter(s => {
    if (viewFilter === 'reclaim') return true; // truck filter not applicable to reclaim list
    if (filterTruck === 'all') return true;
    return String(s.assignedTruck || '') === String(filterTruck);
  });

  if (!token) return <p style={{ padding: 20 }}>Unauthorized</p>;
  if (user?.role !== 'manager') return <p style={{ padding: 20 }}>Forbidden</p>;
  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>My Staff</h2>
      </div>

      <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>View</label>
          <select value={viewFilter} onChange={e => setViewFilter(e.target.value)} style={{ padding: '6px 12px' }}>
            <option value="active">Active Staff</option>
            <option value="reclaim">Previously Managed (Reclaim)</option>
          </select>
        </div>
        {viewFilter === 'active' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by Truck</label>
            <select value={filterTruck} onChange={e => setFilterTruck(e.target.value)} style={{ padding: '6px 12px' }}>
              <option value="all">All Trucks</option>
              {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
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
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.8 }}>{s.email}</div>
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
                  <td style={{ position: 'relative', zIndex: menuOpen[id] ? 50 : 1 }}>
                    {viewFilter === 'reclaim' || !assigned ? (
                      // Unassigned or reclaim: show Assign action only
                      !open ? (
                        <>
                          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setMenuOpen(m => ({ ...m, [id]: !m[id] }))}>Assign ▾</button>
                          {menuOpen[id] && (
                            <div style={{ ...menuBox, background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'var(--shadow-lg)' }}>
                              <button style={{ ...menuItem, color: 'var(--text-primary)' }} onClick={() => { setUiState(u => ({ ...u, [id]: { open: true, target: '' } })); setMenuOpen(m => ({ ...m, [id]: false })); }}>Assign to truck…</button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select value={target} onChange={e => setUiState(u => ({ ...u, [id]: { ...(u[id] || {}), target: e.target.value } }))} style={{ padding: '4px 8px' }}>
                            <option value="" disabled>Select Truck</option>
                            {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                          </select>
                          <button 
                            className="btn btn-sm" 
                            disabled={!!busy[`as:${id}`] || !target} 
                            style={{ 
                              background: !target ? '#cbd5e1' : '#ef4444', 
                              color: '#fff', 
                              border: 'none',
                              cursor: !target ? 'not-allowed' : 'pointer'
                            }}
                            onClick={async () => {
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
                              setUiState(u => ({ ...u, [id]: { open: false, target: '' } }));
                            } catch (e) { alert(e.message); } finally { setBusy(b => ({ ...b, [`as:${id}`]: false })); }
                          }}>Assign</button>
                          <button 
                            className="btn btn-sm" 
                            style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }} 
                            onClick={() => setUiState(u => ({ ...u, [id]: { open: false, target: '' } }))}
                          >Cancel</button>
                        </div>
                      )
                    ) : (
                      // Assigned: Manage dropdown groups Move and Unassign
                      !open ? (
                        <>
                          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setMenuOpen(m => ({ ...m, [id]: !m[id] }))}>Manage ▾</button>
                          {menuOpen[id] && (
                            <div style={{ ...menuBox, background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'var(--shadow-lg)' }}>
                              <button style={{ ...menuItem, color: 'var(--text-primary)' }} onClick={() => {
                                setEditingStaff(s);
                                setEditForm({ name: s.name, staffRole: s.staffRole || 'general' });
                                setMenuOpen(m => ({ ...m, [id]: false }));
                              }}>Edit Details…</button>
                              <button style={{ ...menuItem, color: 'var(--text-primary)' }} onClick={() => { setUiState(u => ({ ...u, [id]: { open: true, target: '' } })); setMenuOpen(m => ({ ...m, [id]: false })); }}>Move…</button>
                              <button style={{ ...menuItem, color: 'var(--danger)' }} disabled={!!busy[`un:${id}`]} onClick={async () => {
                                setMenuOpen(m => ({ ...m, [id]: false }));
                                const truckId = String(s.assignedTruck);
                                setBusy(b => ({ ...b, [`un:${id}`]: true }));
                                try {
                                  await managerApi.unassignStaffFromManagedTruck(token, truckId, id);
                                  setStaff(list => list.map(it => it.id === id ? { ...it, assignedTruck: undefined } : it));
                                  setReclaim(r => r.some(u => u.id === id) ? r : [...r, { id, name: s.name, email: s.email }]);
                                  setUiState(u => ({ ...u, [id]: { open: false, target: '' } }));
                                } catch (e) { alert(e.message); } finally { setBusy(b => ({ ...b, [`un:${id}`]: false })); }
                              }}>Unassign</button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select value={target} onChange={e => setUiState(u => ({ ...u, [id]: { ...(u[id] || {}), target: e.target.value } }))} style={{ padding: '4px 8px' }}>
                            <option value="" disabled>Move to…</option>
                            {trucks.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                          </select>
                          <button 
                            className="btn btn-sm" 
                            disabled={!!busy[`mv:${id}`] || !target} 
                            style={{ 
                              background: !target ? '#cbd5e1' : '#ef4444', 
                              color: '#fff', 
                              border: 'none',
                              cursor: !target ? 'not-allowed' : 'pointer'
                            }}
                            onClick={async () => {
                            if (!target) return;
                            setBusy(b => ({ ...b, [`mv:${id}`]: true }));
                            try {
                              await managerApi.assignStaffToManagedTruck(token, target, id);
                              setStaff(list => list.map(it => it.id === id ? { ...it, assignedTruck: target } : it));
                              setUiState(u => ({ ...u, [id]: { open: false, target: '' } }));
                            } catch (e) { alert(e.message); } finally { setBusy(b => ({ ...b, [`mv:${id}`]: false })); }
                          }}>Apply</button>
                          <button 
                            className="btn btn-sm" 
                            style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }} 
                            onClick={() => setUiState(u => ({ ...u, [id]: { open: false, target: '' } }))}
                          >Close</button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingStaff && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(5px)'
        }}>
          <div className="card" style={{ width: 450, maxWidth: '90%', animation: 'fadeIn 0.2s', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 20, fontSize: 18 }}>Edit Staff Member</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                className="form-control"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Staff Role</label>
              <select
                className="form-control"
                value={editForm.staffRole}
                onChange={e => setEditForm(prev => ({ ...prev, staffRole: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="general">General</option>
                <option value="cook">Cook</option>
                <option value="cashier">Cashier</option>
                <option value="server">Server</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                className="btn"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
                onClick={() => setEditingStaff(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: '#3b82f6', color: '#fff' }}
                disabled={busy[`edit:${editingStaff.id}`]}
                onClick={async () => {
                  const id = editingStaff.id;
                  setBusy(b => ({ ...b, [`edit:${id}`]: true }));
                  try {
                    await managerApi.updateStaffLimited(token, id, editForm);
                    setStaff(list => list.map(it => it.id === id ? { ...it, ...editForm } : it));
                    setEditingStaff(null);
                  } catch (e) {
                    alert(e.message);
                  } finally {
                    setBusy(b => ({ ...b, [`edit:${id}`]: false }));
                  }
                }}
              >
                {busy[`edit:${editingStaff.id}`] ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { textAlign: 'left', padding: 8, background: '#f5f5f5', border: '1px solid #ddd' };
const td = { padding: 8, border: '1px solid #eee' };
const btn = { padding: '4px 8px', marginRight: 6 };
const menuBox = { position: 'absolute', zIndex: 200, right: 0, top: '100%', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', minWidth: 180, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' };
const menuItem = { textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, borderRadius: 4 };

const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' };
const modalContent = { background: 'var(--bg-secondary)', padding: 30, borderRadius: 16, width: '100%', maxWidth: 450, boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(255,255,255,0.1)' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = { width: '100%' };
