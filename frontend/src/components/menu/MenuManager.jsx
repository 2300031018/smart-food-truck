import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';

export default function MenuManager({ truckId }){
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [grouped, setGrouped] = useState(null);
  const [groupMode, setGroupMode] = useState(() => {
    try { return localStorage.getItem('menuGroupMode') === '1'; } catch { return false; }
  });
  const [categoryOrder, setCategoryOrder] = useState(() => {
    try { const raw = localStorage.getItem('menuCategoryOrder'); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { const raw = localStorage.getItem('menuCollapsedCats'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [truck, setTruck] = useState(null);
  const [form, setForm] = useState({ name:'', price:'', category:'', prepTime:'' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name:'', price:'', category:'', prepTime:'' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!truckId) return;
    const fetchData = async () => {
      try {
        const tRes = await api.getTruck(truckId);
        const mRes = await api.getMenuItems(truckId, groupMode ? { group: 'category' } : {});
        if (!mounted) return;
        if (tRes.success) setTruck(tRes.data);
        if (mRes.success) {
          if (groupMode && mRes.data.categories) {
            let cats = mRes.data.categories;
            if (categoryOrder.length) {
              const orderMap = new Map(categoryOrder.map((c,i)=>[c,i]));
              cats = [...cats].sort((a,b)=> {
                const ai = orderMap.has(a.name) ? orderMap.get(a.name) : 9999;
                const bi = orderMap.has(b.name) ? orderMap.get(b.name) : 9999;
                if (ai !== bi) return ai - bi;
                return a.name.localeCompare(b.name);
              });
            }
            setGrouped({ categories: cats });
          } else {
            setItems(mRes.data);
            setGrouped(null);
          }
        }
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    setLoading(true);
    fetchData();
    return () => { mounted = false; };
  }, [truckId, groupMode, categoryOrder]);

  useEffect(() => { try { localStorage.setItem('menuGroupMode', groupMode ? '1':'0'); } catch {} }, [groupMode]);
  useEffect(() => { try { localStorage.setItem('menuCategoryOrder', JSON.stringify(categoryOrder)); } catch {} }, [categoryOrder]);
  useEffect(() => { try { localStorage.setItem('menuCollapsedCats', JSON.stringify(collapsed)); } catch {} }, [collapsed]);

  function onChange(e){ setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function addItem(e){
    e.preventDefault(); setAdding(true); setError(null);
    try {
      const payload = { ...form, price: Number(form.price) };
      const res = await api.addMenuItem(token, truckId, payload);
      if (res.success){
        if (groupMode) {
          const mRes = await api.getMenuItems(truckId, { group: 'category' });
          if (mRes.success) setGrouped(mRes.data);
        } else {
          setItems(i => [...i, res.data]);
        }
        setForm({ name:'', price:'', category:'', prepTime:'' });
      }
    } catch (e){ setError(e.message); } finally { setAdding(false); }
  }

  function startEdit(item){
    setEditingId(item._id);
    setEditForm({ name: item.name, price: item.price, category: item.category || '', prepTime: item.prepTime || '' });
  }

  function onEditChange(e){ setEditForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function saveEdit(e){
    e.preventDefault();
    try {
      const payload = { ...editForm, price: Number(editForm.price) };
      const res = await api.updateMenuItem(token, editingId, payload);
      if (res && (res.success || res._id)) {
        // API may return { success: true, data } or the updated item directly
        const updated = res.data || res;
        if (groupMode) {
          // refetch grouped data to ensure category grouping/order is correct
          const mRes = await api.getMenuItems(truckId, { group: 'category' });
          if (mRes.success) setGrouped(mRes.data);
        } else {
          setItems(items => items.map(it => it._id === editingId ? updated : it));
        }
        setEditingId(null);
      }
    } catch (err) { alert(err.message); }
  }

  async function saveEditDirect(){
    try {
      const payload = { ...editForm, price: Number(editForm.price) };
      const res = await api.updateMenuItem(token, editingId, payload);
      if (res && (res.success || res._id)) {
        const updated = res.data || res;
        if (groupMode) {
          const mRes = await api.getMenuItems(truckId, { group: 'category' });
          if (mRes.success) setGrouped(mRes.data);
        } else {
          setItems(items => items.map(it => it._id === editingId ? updated : it));
        }
        setEditingId(null);
      }
    } catch (err) { alert(err.message); }
  }

  async function doDelete(id){
    if (!confirm('Delete this menu item? This cannot be undone.')) return;
    try {
      const res = await api.deleteMenuItem(token, id);
      if (res) {
        if (groupMode) {
          setGrouped(g => {
            if (!g) return g;
            return { categories: g.categories.map(cat => ({ ...cat, items: cat.items.filter(it => it._id !== id) })) };
          });
        } else {
          setItems(items => items.filter(it => it._id !== id));
        }
      }
    } catch (err) { alert(err.message); }
  }

  async function toggle(id){
    try {
      const res = await api.toggleMenuAvailability(token, id);
      if (res.success){
        if (groupMode) {
          setGrouped(g => {
            if (!g) return g;
            return { categories: g.categories.map(cat => ({ ...cat, items: cat.items.map(it => it._id === id ? res.data : it) })) };
          });
        } else {
          setItems(items => items.map(it => it._id === id ? res.data : it));
        }
      }
    } catch (e){ alert(e.message); }
  }

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (!['admin','manager'].includes(user?.role)) return <p style={{ padding:20 }}>Forbidden: admin/manager only</p>;
  if (!truckId) return <p style={{ padding:20 }}>Select a truck</p>;
  if (loading) return <p style={{ padding:20 }}>Loading...</p>;
  if (error) return <p style={{ padding:20, color:'red' }}>{error}</p>;
  if (!truck) return <p style={{ padding:20 }}>Truck not found</p>;

  return (
    <div>
      <h3>Manage Menu – {truck.name}</h3>
      <div style={{ margin:'8px 0 16px', display:'flex', gap:12, alignItems:'center' }}>
        <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:14 }}>
          <input type="checkbox" checked={groupMode} onChange={e => setGroupMode(e.target.checked)} /> Group by Category
        </label>
        {groupMode && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <CategoryOrderEditor categories={grouped?.categories || []} order={categoryOrder} setOrder={setCategoryOrder} />
          </div>
        )}
      </div>
      <form onSubmit={addItem} style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
        <input name="name" placeholder="Name" value={form.name} onChange={onChange} required />
        <input name="price" placeholder="Price" type="number" step="0.01" value={form.price} onChange={onChange} required />
        <input name="category" placeholder="Category" value={form.category} onChange={onChange} />
        <input name="prepTime" placeholder="Prep (min)" value={form.prepTime} onChange={onChange} />
        <button disabled={adding}>{adding ? 'Adding...' : 'Add Item'}</button>
      </form>
      {!groupMode && (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Price (INR)</th>
              <th style={th}>Category</th>
              <th style={th}>Prep (min)</th>
              <th style={th}>Available</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it._id} style={{ borderBottom:'1px solid #ddd' }}>
                <td style={td}>{editingId === it._id ? (<input name="name" value={editForm.name} onChange={onEditChange} required />) : it.name}</td>
                <td style={td}>{editingId === it._id ? (<input name="price" type="number" step="0.01" value={editForm.price} onChange={onEditChange} required />) : formatCurrency(it.price)}</td>
                <td style={td}>{editingId === it._id ? (<input name="category" value={editForm.category} onChange={onEditChange} />) : (it.category || '-')}</td>
                <td style={td}>{editingId === it._id ? (<input name="prepTime" value={editForm.prepTime} onChange={onEditChange} placeholder="Prep min" />) : (it.prepTime || '-')}</td>
                <td style={td}>{it.isAvailable ? 'Yes' : 'No'}</td>
                <td style={td}>
                  {editingId === it._id ? (
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" onClick={saveEditDirect}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" onClick={() => startEdit(it)}>Edit</button>
                      <button type="button" onClick={() => doDelete(it._id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {groupMode && grouped && (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {grouped.categories.map(cat => {
            const isCollapsed = collapsed[cat.name];
            return (
            <div key={cat.name} style={{ border:'1px solid #e2e2e2', borderRadius:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', cursor:'pointer', background:'#fafafa', padding:'6px 10px' }} onClick={() => setCollapsed(c => ({ ...c, [cat.name]: !c[cat.name] }))}>
                <h3 style={{ margin:0, fontSize:16 }}>{cat.name}</h3>
                <span style={{ fontSize:12, opacity:0.7 }}>{isCollapsed ? '▶' : '▼'}</span>
              </div>
              {!isCollapsed && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Name</th>
                    <th style={th}>Price (INR)</th>
                    <th style={th}>Prep (min)</th>
                    <th style={th}>Available</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map(it => (
                    <tr key={it._id} style={{ borderBottom:'1px solid #ddd' }}>
                      <td style={td}>{editingId === it._id ? (<input name="name" value={editForm.name} onChange={onEditChange} required />) : it.name}</td>
                      <td style={td}>{editingId === it._id ? (<input name="price" type="number" step="0.01" value={editForm.price} onChange={onEditChange} required />) : formatCurrency(it.price)}</td>
                      <td style={td}>{editingId === it._id ? (<input name="prepTime" value={editForm.prepTime} onChange={onEditChange} placeholder="Prep min" />) : (it.prepTime || '-')}</td>
                      <td style={td}>{it.isAvailable ? 'Yes' : 'No'}</td>
                      <td style={td}>
                        {editingId === it._id ? (
                          <div style={{ display:'flex', gap:8 }}>
                            <button type="button" onClick={saveEditDirect}>Save</button>
                            <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display:'flex', gap:8 }}>
                            <button type="button" onClick={() => startEdit(it)}>Edit</button>
                            <button type="button" onClick={() => doDelete(it._id)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', border:'1px solid #ddd' };
const td = { padding:6, border:'1px solid #ddd', fontSize:14 };

function CategoryOrderEditor({ categories, order, setOrder }) {
  const names = categories.map(c => c.name);
  const cleaned = order.filter(o => names.includes(o));
  if (cleaned.length !== order.length) {
    setTimeout(() => setOrder(cleaned), 0);
  }
  function move(name, dir){
    setOrder(o => {
      const arr = o.slice();
      if (!arr.includes(name)) arr.push(name);
      const idx = arr.indexOf(name);
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  }
  function addMissing(){ setOrder(o => [...o, ...names.filter(n => !o.includes(n))]); }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, background:'#f7f7f7', padding:8, borderRadius:4 }}>
      <strong style={{ fontSize:13 }}>Category Order</strong>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {cleaned.map(name => (
          <div key={name} style={{ display:'flex', alignItems:'center', gap:4, background:'#fff', padding:'2px 6px', border:'1px solid #ccc', borderRadius:4 }}>
            <span>{name}</span>
            <button type="button" onClick={()=>move(name,-1)} style={{ border:'1px solid #bbb', background:'#fafafa', fontSize:11, padding:'2px 4px' }}>↑</button>
            <button type="button" onClick={()=>move(name,1)} style={{ border:'1px solid #bbb', background:'#fafafa', fontSize:11, padding:'2px 4px' }}>↓</button>
          </div>
        ))}
        <button type="button" onClick={addMissing} style={{ border:'1px solid #bbb', background:'#fafafa', fontSize:11, padding:'2px 4px' }}>Add Missing</button>
      </div>
    </div>
  );
}
