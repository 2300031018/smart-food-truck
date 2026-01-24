import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapEmbed from '../components/MapEmbed';
import { getSocket } from '../realtime/socket';

export default function Trucks() {
  const { token, user } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTruck, setNewTruck] = useState({ name:'', description:'', managerId:'' });
  const [updating, setUpdating] = useState(null);
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
  const res = await api.getTrucks();
        if (res.success && mounted) setTrucks(res.data);
        if (token && user?.role === 'admin') {
          try {
            const mgrRes = await api.getManagers(token);
            if (mgrRes.success && mounted) setManagers(mgrRes.data);
          } catch {}
        }
      } catch (err){ if (mounted) setError(err.message); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [token, user]);

  // Removed periodic polling; rely on websocket location updates

  // Realtime: subscribe to each truck room in the list for location updates
  useEffect(() => {
    const sock = getSocket(token);
    const rooms = new Set();
    (trucks || []).forEach(t => rooms.add(`truck:${t.id || t._id}`));
    rooms.forEach(room => sock.emit('subscribe', { room }));
    const onLoc = ({ truckId, liveLocation }) => {
      setTrucks(list => list.map(t => (t.id === truckId || t._id === truckId) ? { ...t, liveLocation } : t));
    };
    sock.on('truck:location', onLoc);
    return () => {
      try { rooms.forEach(room => sock.emit('unsubscribe', { room })); sock.off('truck:location', onLoc); } catch {}
    };
  }, [token, trucks.map(t => t.id || t._id).join(',')]);

  if (loading) return <p style={{ padding: 20 }}>Loading trucks...</p>;
  if (error) return <p style={{ color: 'red', padding: 20 }}>{error}</p>;

  async function submitTruck(e){
    e.preventDefault();
    setCreating(true); setError(null);
    try {
  const payload = { name: newTruck.name, description: newTruck.description };
  if (user.role === 'admin' && newTruck.managerId) payload.managerId = newTruck.managerId;
  const res = await api.createTruck(token, payload);
      if (res.success){
        setTrucks(t => [...t, res.data]);
  setNewTruck({ name:'', description:'', managerId:'' });
      }
    } catch (e){ setError(e.message); } finally { setCreating(false); }
  }

  async function handleAssignManager(truck, managerId){
    if (!managerId) return;
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.assignManager(token, truck.id || truck._id, managerId);
      if (res.success){
        setTrucks(ts => ts.map(t => ( (t.id||t._id) === (truck.id||truck._id) ? { ...t, manager: res.data.manager } : t )));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  async function handleUnassignManager(truck){
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.unassignManager(token, truck.id || truck._id);
      if (res.success){
        setTrucks(ts => ts.map(t => ( (t.id||t._id) === (truck.id||truck._id) ? { ...t, manager: null } : t )));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  async function handleUpdateStatus(truck, status){
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.updateTruckStatusLocation(token, truck.id || truck._id, { status });
      if (res.success){
        setTrucks(ts => ts.map(t => ( (t.id||t._id) === (truck.id||truck._id) ? { ...t, status: res.data.status } : t )));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  async function handleDeleteTruck(truck){
    if (!token || user.role !== 'admin') return;
    if (!window.confirm(`Delete truck "${truck.name}"? This will remove its menu items and unassign its staff.`)) return;
    setUpdating(truck.id || truck._id);
    try {
      const res = await api.deleteTruck(token, truck.id || truck._id);
      if (res.success){
        setTrucks(ts => ts.filter(t => (t.id||t._id) !== (truck.id||truck._id)));
      }
    } catch (e){ setError(e.message); } finally { setUpdating(null); }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h2>Food Trucks</h2>
      {token && ['admin','manager'].includes(user.role) && (
        <form onSubmit={submitTruck} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          <input placeholder="Name" value={newTruck.name} onChange={e=> setNewTruck(nt => ({ ...nt, name:e.target.value }))} required />
            <input placeholder="Description" value={newTruck.description} onChange={e=> setNewTruck(nt => ({ ...nt, description:e.target.value }))} />
          {user.role === 'admin' && (
            <select value={newTruck.managerId} onChange={e=> setNewTruck(nt => ({ ...nt, managerId:e.target.value }))} required>
              <option value=''>Select Manager</option>
              {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
            </select>
          )}
          <button disabled={creating}>{creating ? 'Creating...' : 'Create Truck'}</button>
        </form>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Status</th>
              <th style={th}>Live Location</th>
              {token && user.role!=='customer' && <th style={th}>Manager</th>}
              {token && user.role!=='customer' && <th style={th}>Staff Count</th>}
              {token && user.role==='admin' && <th style={th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {trucks.map(t => (
              <tr key={t.id || t._id} style={{ borderTop:'1px solid #eee' }}>
                <td style={td}><Link to={`/trucks/${t.id || t._id}`}>{t.name}</Link></td>
                <td style={td}>{t.status}</td>
                <td style={td}>
                  {(() => {
                    const live = t.liveLocation;
                    const base = t.location;
                    const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
                    const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
                    if (lat !== null && lng !== null) {
                      return (
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            {`${lat.toFixed(3)}, ${lng.toFixed(3)}`} {' '}
                            <a href={`https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`} target="_blank" rel="noreferrer">Directions</a>
                          </div>
                          <MapEmbed lat={lat} lng={lng} height={120} />
                        </div>
                      );
                    }
                    return <span style={{ opacity:.5 }}>No live location</span>;
                  })()}
                </td>
                {token && user.role!=='customer' && (
                  <td style={td}>{t.manager ? t.manager.email || t.manager.name : <em style={{ opacity:.6 }}>Unassigned</em>}</td>
                )}
                {token && user.role!=='customer' && (
                  <td style={td}>{t.staffCount ?? '—'}</td>
                )}
                {token && user.role==='admin' && (
                  <td style={td}>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {!t.manager && managers.length>0 && (
                        <select onChange={e=> handleAssignManager(t, e.target.value)} defaultValue=''>
                          <option value='' disabled>Assign mgr</option>
                          {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                        </select>
                      )}
                      {t.manager && <button onClick={()=>handleUnassignManager(t)} disabled={updating===t.id}>Unassign</button>}
                      <button onClick={()=>handleUpdateStatus(t,'active')} disabled={updating===t.id || t.status==='active'}>Active</button>
                      <button onClick={()=>handleUpdateStatus(t,'offline')} disabled={updating===t.id || t.status==='offline'}>Offline</button>
                      <button onClick={()=>handleDeleteTruck(t)} disabled={updating===t.id} style={{ background:'#b91c1c', color:'#fff' }}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', fontSize:12 };
const td = { padding:6, fontSize:13 };

async function noop(){}
