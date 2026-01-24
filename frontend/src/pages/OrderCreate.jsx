import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';

export default function OrderCreate(){
  const { token } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [truckId, setTruckId] = useState('');
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]); // {menuItem, name, quantity, unitPrice}
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    api.getTrucks().then(r => { if(r.success) setTrucks(r.data); });
  }, []);

  useEffect(() => {
    if (truckId){
      api.getMenuItems(truckId).then(r => { if(r.success) setMenu(r.data); });
      setCart([]);
    }
  }, [truckId]);

  function addToCart(item){
    setCart(c => {
      const existing = c.find(ci => ci.menuItem === item._id);
      if (existing){
        return c.map(ci => ci.menuItem === item._id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...c, { menuItem: item._id, name:item.name, quantity:1, unitPrice:item.price }];
    });
  }

  function updateQty(id, qty){
    setCart(c => c.map(ci => ci.menuItem === id ? { ...ci, quantity: qty } : ci));
  }

  const total = cart.reduce((s,i)=> s + i.unitPrice * i.quantity, 0);

  async function submit(e){
    e.preventDefault();
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      const payload = { truck: truckId, items: cart.map(c => ({ menuItem: c.menuItem, quantity: c.quantity })), notes };
      const res = await api.createOrder(token, payload);
      if (res.success){
        setSuccess(res.data._id);
        setLastOrder({ id: res.data._id, truckId, truckName: (trucks.find(t => (t.id||t._id)===truckId)?.name) });
        setCart([]); setNotes('');
      }
    } catch (e){ setError(e.message); } finally { setSubmitting(false); }
  }

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Create Order</h2>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:600 }}>
        <select value={truckId} onChange={e=> setTruckId(e.target.value)} required>
          <option value="">Select Truck</option>
          {trucks.map(t => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
        </select>
        {truckId && (
          <div style={{ display:'flex', gap:24 }}>
            <div style={{ flex:1 }}>
              <h4>Menu</h4>
              <ul style={{ listStyle:'none', padding:0 }}>
                {menu.length === 0 && (
                  <li style={{ opacity:.7, fontSize:12 }}>No items available for this truck.</li>
                )}
                {menu.map(mi => (
                  <li key={mi._id} style={{ marginBottom:4 }}>
                    {mi.name} {formatCurrency(mi.price)} <button type="button" onClick={()=> addToCart(mi)}>Add</button>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ flex:1 }}>
              <h4>Cart</h4>
              {cart.length === 0 && <p style={{ fontSize:12 }}>No items yet.</p>}
              {cart.map(c => (
                <div key={c.menuItem} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ flex:1 }}>{c.name}</span>
                  <input type="number" min={1} value={c.quantity} onChange={e=> updateQty(c.menuItem, Number(e.target.value))} style={{ width:60 }} />
                  <span>{formatCurrency(c.unitPrice * c.quantity)}</span>
                </div>
              ))}
              <div style={{ fontWeight:'bold', marginTop:8 }}>Total: {formatCurrency(total)}</div>
            </div>
          </div>
        )}
        <textarea placeholder="Notes (optional)" value={notes} onChange={e=> setNotes(e.target.value)} />
        <button disabled={submitting || cart.length===0}>{submitting ? 'Submitting...' : 'Submit Order'}</button>
        {error && <div style={{ color:'red' }}>{error}</div>}
        {success && (
          <div style={{ background:'#ecfdf5', border:'1px solid #a7f3d0', color:'#065f46', padding:'10px', borderRadius:6 }}>
            <div style={{ fontWeight:'bold' }}>Order placed!</div>
            <div>Pickup only: collect from <a href={`/trucks/${lastOrder?.truckId}`}>{lastOrder?.truckName || 'the truck'}</a>.</div>
            <div>Order #: <span style={{ fontFamily:'monospace' }}>{shortCode(success)}</span> · Pickup Code: <strong>{(success||'').slice(-6).toUpperCase()}</strong></div>
          </div>
        )}
      </form>
    </div>
  );
}

function shortCode(id){ try { return `ORD-${(id||'').slice(-6).toUpperCase()}`; } catch { return 'ORD-—'; } }