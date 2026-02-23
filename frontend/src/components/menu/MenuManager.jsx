import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';

export default function MenuManager({ truckId }) {
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
  const [form, setForm] = useState({ name: '', price: '', category: '', prepTime: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', category: '', prepTime: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!truckId) return;
    const fetchData = async () => {
      try {
        const tRes = await api.getTruck(truckId);
        const mRes = await api.getMenuItems(truckId, { all: true, ...(groupMode ? { group: 'category' } : {}) });
        if (!mounted) return;
        if (tRes.success) setTruck(tRes.data);
        if (mRes.success) {
          if (groupMode && mRes.data.categories) {
            let cats = mRes.data.categories;
            if (categoryOrder.length) {
              const orderMap = new Map(categoryOrder.map((c, i) => [c, i]));
              cats = [...cats].sort((a, b) => {
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

  useEffect(() => { try { localStorage.setItem('menuGroupMode', groupMode ? '1' : '0'); } catch { } }, [groupMode]);
  useEffect(() => { try { localStorage.setItem('menuCategoryOrder', JSON.stringify(categoryOrder)); } catch { } }, [categoryOrder]);
  useEffect(() => { try { localStorage.setItem('menuCollapsedCats', JSON.stringify(collapsed)); } catch { } }, [collapsed]);

  function onChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function addItem(e) {
    e.preventDefault(); setAdding(true); setError(null);
    try {
      const payload = { ...form, price: Number(form.price) };
      const res = await api.addMenuItem(token, truckId, payload);
      if (res.success) {
        if (groupMode) {
          const mRes = await api.getMenuItems(truckId, { group: 'category', all: true });
          if (mRes.success) setGrouped(mRes.data);
        } else {
          setItems(i => [...i, res.data]);
        }
        setForm({ name: '', price: '', category: '', prepTime: '' });
      }
    } catch (e) { setError(e.message); } finally { setAdding(false); }
  }

  function startEdit(item) {
    setEditingId(item._id);
    setEditForm({ name: item.name, price: item.price, category: item.category || '', prepTime: item.prepTime || '' });
  }

  function onEditChange(e) { setEditForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  async function saveEditDirect() {
    try {
      const payload = { ...editForm, price: Number(editForm.price) };
      const res = await api.updateMenuItem(token, editingId, payload);
      if (res && (res.success || res._id)) {
        const updated = res.data || res;
        if (groupMode) {
          const mRes = await api.getMenuItems(truckId, { group: 'category', all: true });
          if (mRes.success) setGrouped(mRes.data);
        } else {
          setItems(items => items.map(it => it._id === editingId ? updated : it));
        }
        setEditingId(null);
      }
    } catch (err) { alert(err.message); }
  }

  async function doDelete(id) {
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

  async function toggle(id) {
    try {
      const res = await api.toggleMenuAvailability(token, id);
      if (res.success) {
        if (groupMode) {
          setGrouped(g => {
            if (!g) return g;
            return { categories: g.categories.map(cat => ({ ...cat, items: cat.items.map(it => it._id === id ? res.data : it) })) };
          });
        } else {
          setItems(items => items.map(it => it._id === id ? res.data : it));
        }
      }
    } catch (e) { alert(e.message); }
  }

  if (!token) return <p style={{ padding: 20 }}>Unauthorized</p>;
  if (!['admin', 'manager'].includes(user?.role)) return <p style={{ padding: 20 }}>Forbidden: admin/manager only</p>;
  if (!truckId) return <p style={{ padding: 20 }}>Select a truck</p>;
  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (error) return <p style={{ padding: 20, color: 'red' }}>{error}</p>;
  if (!truck) return <p style={{ padding: 20 }}>Truck not found</p>;

  return (
    <div className="menu-manager">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0 }}>Manage Menu – {truck.name}</h3>
        <div className="btn-group">
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 20 }}>
            <input type="checkbox" checked={groupMode} onChange={e => setGroupMode(e.target.checked)} />
            <span>Group by Category</span>
          </label>
        </div>
      </div>

      {groupMode && (
        <div style={{ marginBottom: 24 }}>
          <CategoryOrderEditor categories={grouped?.categories || []} order={categoryOrder} setOrder={setCategoryOrder} />
        </div>
      )}

      <div className="card" style={{ marginBottom: 24, background: 'rgba(255,255,255,0.02)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 15, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add New Menu Item</h4>
        <form onSubmit={addItem} className="control-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <input name="name" placeholder="Item Name" value={form.name} onChange={onChange} required style={{ flex: 2, minWidth: 200 }} />
          <input name="price" placeholder="Price (INR)" type="number" step="0.01" value={form.price} onChange={onChange} required style={{ flex: 1, minWidth: 100 }} />
          <input name="category" placeholder="Category" value={form.category} onChange={onChange} style={{ flex: 1, minWidth: 120 }} />
          <input name="prepTime" placeholder="Prep Time (min)" value={form.prepTime} onChange={onChange} style={{ flex: 1, minWidth: 100 }} />
          <button className="btn btn-primary" disabled={adding} style={{ flex: 0, whiteSpace: 'nowrap' }}>{adding ? 'Adding...' : '+ Add Item'}</button>
        </form>
      </div>

      {!groupMode ? (
        <div style={{ overflow: 'hidden', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Category</th>
                <th>Prep</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it._id}>
                  <td>{editingId === it._id ? (<input name="name" value={editForm.name} onChange={onEditChange} required style={{ width: '100%' }} />) : <strong>{it.name}</strong>}</td>
                  <td>{editingId === it._id ? (<input name="price" type="number" step="0.01" value={editForm.price} onChange={onEditChange} required style={{ width: 80 }} />) : formatCurrency(it.price)}</td>
                  <td>{editingId === it._id ? (<input name="category" value={editForm.category} onChange={onEditChange} style={{ width: 100 }} />) : <span style={{ color: 'var(--text-secondary)' }}>{it.category || '-'}</span>}</td>
                  <td>{editingId === it._id ? (<input name="prepTime" value={editForm.prepTime} onChange={onEditChange} placeholder="min" style={{ width: 60 }} />) : (it.prepTime ? `${it.prepTime} min` : '-')}</td>
                  <td>
                    <span className={`badge ${it.isAvailable ? 'badge-green' : 'badge-red'}`} style={{ cursor: 'pointer' }} onClick={() => toggle(it._id)}>
                      {it.isAvailable ? 'Available' : 'Sold Out'}
                    </span>
                  </td>
                  <td>
                    {editingId === it._id ? (
                      <div className="btn-group">
                        <button className="btn btn-sm btn-primary" onClick={saveEditDirect}>Save</button>
                        <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="btn-group">
                        <button className="btn btn-sm" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }} onClick={() => startEdit(it)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => doDelete(it._id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped?.categories.map(cat => {
            const isCollapsed = collapsed[cat.name];
            return (
              <div key={cat.name} style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', alignItems: 'center' }}
                  onClick={() => setCollapsed(c => ({ ...c, [cat.name]: !c[cat.name] }))}
                >
                  <h4 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    {cat.name} <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.5 }}>({cat.items.length} items)</span>
                  </h4>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>{isCollapsed ? '▶' : '▼'}</span>
                </div>
                {!isCollapsed && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Prep</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.items.map(it => (
                        <tr key={it._id}>
                          <td>{editingId === it._id ? (<input name="name" value={editForm.name} onChange={onEditChange} required style={{ width: '100%' }} />) : <strong>{it.name}</strong>}</td>
                          <td>{editingId === it._id ? (<input name="price" type="number" step="0.01" value={editForm.price} onChange={onEditChange} required style={{ width: 80 }} />) : formatCurrency(it.price)}</td>
                          <td>{editingId === it._id ? (<input name="prepTime" value={editForm.prepTime} onChange={onEditChange} placeholder="min" style={{ width: 60 }} />) : (it.prepTime ? `${it.prepTime} min` : '-')}</td>
                          <td>
                            <span className={`badge ${it.isAvailable ? 'badge-green' : 'badge-red'}`} style={{ cursor: 'pointer' }} onClick={() => toggle(it._id)}>
                              {it.isAvailable ? 'Available' : 'Sold Out'}
                            </span>
                          </td>
                          <td>
                            {editingId === it._id ? (
                              <div className="btn-group">
                                <button className="btn btn-sm btn-primary" onClick={saveEditDirect}>Save</button>
                                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setEditingId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div className="btn-group">
                                <button className="btn btn-sm" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }} onClick={() => startEdit(it)}>Edit</button>
                                <button className="btn btn-sm btn-danger" onClick={() => doDelete(it._id)}>Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryOrderEditor({ categories, order, setOrder }) {
  const names = categories.map(c => c.name);
  const cleaned = order.filter(o => names.includes(o));
  if (cleaned.length !== order.length) {
    setTimeout(() => setOrder(cleaned), 0);
  }
  function move(name, dir) {
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
  function addMissing() { setOrder(o => [...o, ...names.filter(n => !o.includes(n))]); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
      <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Category Order</strong>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cleaned.map(name => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}>
            <span>{name}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="btn btn-sm" type="button" onClick={() => move(name, -1)} style={{ padding: '2px 4px', fontSize: 10 }}>↑</button>
              <button className="btn btn-sm" type="button" onClick={() => move(name, 1)} style={{ padding: '2px 4px', fontSize: 10 }}>↓</button>
            </div>
          </div>
        ))}
        <button className="btn btn-sm btn-primary" type="button" onClick={addMissing} style={{ padding: '4px 10px', fontSize: 11 }}>+ Add Missing</button>
      </div>
    </div>
  );
}
