import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function StaffStock(){
  const { token, user } = useAuth();
  const assignedTruckId = useMemo(() => user?.assignedTruck || user?.truckId || null, [user]);
  const [truck, setTruck] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});

  useEffect(() => {
    let mounted = true;
    async function load(){
      if (!assignedTruckId) { setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const [t, m] = await Promise.all([
          api.getTruck(assignedTruckId),
          api.getMenuItems(assignedTruckId)
        ]);
        if (!mounted) return;
        if (t?.success) setTruck(t.data);
        if (m?.success) setItems(m.data || []);
      } catch(e){ if (mounted) setError(e.message); } finally { if (mounted) setLoading(false); }
    }
    if (token) load();
    return () => { mounted = false; };
  }, [token, assignedTruckId]);

  async function toggleAvailability(item){
    const id = item._id;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await api.updateMenuStock(token, id, { isAvailable: !item.isAvailable });
      if (res && res.success) {
        // Some APIs return the updated item under data; fall back to optimistic update if missing
        const updated = res.data || { ...item, isAvailable: !item.isAvailable };
        setItems(list => list.map(it => it._id === id ? updated : it));
      } else {
        // if response shape differs, still reflect optimistic state
        setItems(list => list.map(it => it._id === id ? { ...it, isAvailable: !item.isAvailable } : it));
      }
    } catch(e){ alert(e.message || 'Failed to update stock'); }
    finally { setBusy(b => ({ ...b, [id]: false })); }
  }

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'staff') return <p style={{ padding:20 }}>Forbidden: staff only</p>;
  if (!assignedTruckId) return <div style={{ padding:20 }}><h2>My Stock</h2><p>No truck assigned to your account yet.</p></div>;
  if (loading) return <p style={{ padding:20 }}>Loading…</p>;
  if (error) return <p style={{ padding:20, color:'red' }}>{error}</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>My Stock – {truck?.name || '—'}</h2>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Category</th>
            <th style={th}>Available</th>
            <th style={th}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it._id} style={{ borderTop:'1px solid #eee' }}>
              <td style={td}>{it.name}</td>
              <td style={td}>{it.category || '-'}</td>
              <td style={td}>{it.isAvailable ? 'Yes' : 'No'}</td>
              <td style={td}>
                <button onClick={()=> toggleAvailability(it)} disabled={!!busy[it._id]}>
                  {busy[it._id] ? 'Updating…' : (it.isAvailable ? 'Mark sold out' : 'Mark in stock')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd' };
const td = { padding:6, border:'1px solid #eee' };
