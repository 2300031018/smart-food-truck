import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../realtime/socket';
import { loadGoogleMapsApi } from '../hooks/useGoogleMapsApi';

export default function Trucks() {
  const { token, user } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTruck, setNewTruck] = useState({ name:'', description:'', managerId:'' });
  const [updating, setUpdating] = useState(null);
  const [managers, setManagers] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) || null;

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

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !apiKey || trucks.length === 0) return;
    
    (async () => {
      try {
        const maps = await loadGoogleMapsApi(apiKey);
        
        // Calculate bounds
        const bounds = new maps.LatLngBounds();
        trucks.forEach(t => {
          const live = t.liveLocation;
          const base = t.location;
          const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
          const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
          if (lat && lng) bounds.extend(new maps.LatLng(lat, lng));
        });

        // Create map
        if (!mapRef.current.mapInstance) {
          mapRef.current.mapInstance = new maps.Map(mapRef.current, {
            zoom: 12,
            center: { lat: 20.5937, lng: 78.9629 } // Default to India
          });
        }
        const map = mapRef.current.mapInstance;

        // Add markers
        markersRef.current = {};
        trucks.forEach(t => {
          const live = t.liveLocation;
          const base = t.location;
          const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
          const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);
          
          if (lat && lng) {
            const marker = new maps.Marker({
              position: { lat, lng },
              map: map,
              title: t.name,
              icon: getMarkerIcon(t.status)
            });
            
            marker.addListener('click', () => {
              setSelectedTruck(t);
            });
            
            markersRef.current[t.id || t._id] = marker;
          }
        });

        // Fit bounds
        if (Object.keys(markersRef.current).length > 0) {
          map.fitBounds(bounds);
        }
        
        setMapLoaded(true);
      } catch (e) {
        console.error('Map error:', e);
      }
    })();
  }, [trucks, apiKey]);

  // Realtime: subscribe to each truck room for location updates
  useEffect(() => {
    const sock = getSocket(token);
    const rooms = new Set();
    (trucks || []).forEach(t => rooms.add(`truck:${t.id || t._id}`));
    rooms.forEach(room => sock.emit('subscribe', { room }));
    
    const onLoc = ({ truckId, liveLocation }) => {
      setTrucks(list => list.map(t => (t.id === truckId || t._id === truckId) ? { ...t, liveLocation } : t));
      // Update marker position
      if (markersRef.current[truckId]) {
        markersRef.current[truckId].setPosition({ lat: liveLocation.lat, lng: liveLocation.lng });
      }
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

      {/* Map View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 16, height: 'calc(100vh - 200px)', marginBottom: 20 }}>
        <div ref={mapRef} style={{ background: '#f0f0f0', borderRadius: 8, border: '1px solid #ddd' }}></div>
        
        {/* Truck Details Sidebar */}
        <div style={{ overflowY: 'auto', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
          {selectedTruck ? (
            <TruckDetailCard 
              truck={selectedTruck} 
              token={token} 
              user={user}
              onClose={() => setSelectedTruck(null)}
              managers={managers}
              updating={updating}
              setUpdating={setUpdating}
              handleAssignManager={handleAssignManager}
              handleUnassignManager={handleUnassignManager}
              handleUpdateStatus={handleUpdateStatus}
              handleDeleteTruck={handleDeleteTruck}
            />
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
              <p>Click on a truck marker to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Control Panel */}
      {token && user.role === 'admin' && (
        <div style={{ marginTop: 20 }}>
          <h3>Admin Panel</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Manager</th>
                  <th style={th}>Staff Count</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.id || t._id} style={{ borderTop:'1px solid #eee' }}>
                    <td style={td}>{t.name}</td>
                    <td style={td}>{t.status}</td>
                    <td style={td}>{t.manager ? t.manager.email || t.manager.name : <em style={{ opacity:.6 }}>Unassigned</em>}</td>
                    <td style={td}>{t.staffCount ?? '—'}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TruckDetailCard({ truck, token, user, onClose, managers, updating, setUpdating, handleAssignManager, handleUnassignManager, handleUpdateStatus, handleDeleteTruck }) {
  const [activeTab, setActiveTab] = useState('info'); // info, menu, order, reserve
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [currentTruckId, setCurrentTruckId] = useState(truck.id || truck._id);

  const live = truck.liveLocation;
  const base = truck.location;
  const lat = typeof live?.lat === 'number' ? live.lat : (typeof base?.lat === 'number' ? base.lat : null);
  const lng = typeof live?.lng === 'number' ? live.lng : (typeof base?.lng === 'number' ? base.lng : null);

  // Reset state when truck changes
  useEffect(() => {
    const newTruckId = truck.id || truck._id;
    if (newTruckId !== currentTruckId) {
      setCurrentTruckId(newTruckId);
      setActiveTab('info');
      setMenu([]);
      setCart([]);
      setNotes('');
      setSuccess(false);
      setError(null);
    }
  }, [truck.id, truck._id, currentTruckId]);

  // Load menu when switching to menu or order tab
  useEffect(() => {
    if ((activeTab === 'menu' || activeTab === 'order') && menu.length === 0) {
      api.getMenuItems(truck.id || truck._id).then(r => { if (r.success) setMenu(r.data); });
    }
  }, [activeTab, truck.id, truck._id, menu.length]);

  function addToCart(item) {
    setCart(c => {
      const existing = c.find(ci => ci.menuItem === item._id);
      if (existing) {
        return c.map(ci => ci.menuItem === item._id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      return [...c, { menuItem: item._id, name: item.name, quantity: 1, unitPrice: item.price }];
    });
  }

  function updateQty(id, qty) {
    if (qty <= 0) {
      setCart(c => c.filter(ci => ci.menuItem !== id));
    } else {
      setCart(c => c.map(ci => ci.menuItem === id ? { ...ci, quantity: qty } : ci));
    }
  }

  async function submitOrder(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = { truck: truck.id || truck._id, items: cart.map(c => ({ menuItem: c.menuItem, quantity: c.quantity })), notes };
      const res = await api.createOrder(token, payload);
      if (res.success) {
        setSuccess(true);
        setCart([]);
        setNotes('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const total = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{truck.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ background: truck.status === 'active' ? '#d1fae5' : '#fee2e2', color: truck.status === 'active' ? '#065f46' : '#991b1b', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
              {truck.status}
            </span>
          </div>
          {truck.description && (
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#555' }}>{truck.description}</p>
          )}
          {lat && lng && (
            <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#666' }}>
              📍 {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #eee', marginBottom: 12 }}>
          <button onClick={() => setActiveTab('info')} style={{ flex: 1, padding: '8px 12px', background: activeTab === 'info' ? '#2563eb' : '#f5f5f5', color: activeTab === 'info' ? '#fff' : '#333', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12 }}>
            Info
          </button>
          {token && user?.role === 'customer' && (
            <>
              <button onClick={() => setActiveTab('menu')} style={{ flex: 1, padding: '8px 12px', background: activeTab === 'menu' ? '#2563eb' : '#f5f5f5', color: activeTab === 'menu' ? '#fff' : '#333', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12 }}>
                Menu
              </button>
              <button onClick={() => setActiveTab('order')} style={{ flex: 1, padding: '8px 12px', background: activeTab === 'order' ? '#16a34a' : '#f5f5f5', color: activeTab === 'order' ? '#fff' : '#333', border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer', fontSize: 12 }}>
                Order {cart.length > 0 && `(${cart.length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'info' && (
          <div>
            {token && user?.role === 'customer' && (
              <div style={{ marginBottom: 12 }}>
                <Link to={`/reservations/new?truck=${truck.id || truck._id}`} style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', padding: '8px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    📅 Book This Truck
                  </button>
                </Link>
              </div>
            )}

            {token && user?.role === 'admin' && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Manager: {truck.manager ? truck.manager.email || truck.manager.name : 'Unassigned'}</label>
                  {!truck.manager && managers.length > 0 && (
                    <select onChange={e => handleAssignManager(truck, e.target.value)} defaultValue='' style={{ width: '100%', padding: 4 }}>
                      <option value='' disabled>Assign manager</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                    </select>
                  )}
                  {truck.manager && (
                    <button onClick={() => handleUnassignManager(truck)} disabled={updating === truck.id} style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}>
                      Unassign Manager
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => handleUpdateStatus(truck, 'active')} disabled={updating === truck.id || truck.status === 'active'} style={{ flex: 1, fontSize: 12 }}>Active</button>
                  <button onClick={() => handleUpdateStatus(truck, 'offline')} disabled={updating === truck.id || truck.status === 'offline'} style={{ flex: 1, fontSize: 12 }}>Offline</button>
                  <button onClick={() => handleDeleteTruck(truck)} disabled={updating === truck.id} style={{ background: '#b91c1c', color: '#fff', flex: 1, fontSize: 12 }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div>
            {cart.length > 0 && token && user?.role === 'customer' && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', borderRadius: 4, border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 12, marginBottom: 8, color: '#1e40af' }}>
                  <strong>🛒 Cart: {cart.length} item(s)</strong> · Total: <strong>₹{cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}</strong>
                </div>
                <button onClick={() => setActiveTab('order')} style={{ width: '100%', padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                  View Cart & Checkout →
                </button>
              </div>
            )}
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Menu Items</h4>
            {menu.length === 0 ? (
              <p style={{ fontSize: 12, color: '#666' }}>No menu items available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menu.map(item => {
                  const inCart = cart.find(c => c.menuItem === item._id);
                  const isSoldOut = item.availability === 'sold-out';
                  return (
                    <div key={item._id} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6, background: inCart ? '#f0f9ff' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 2 }}>{item.name}</div>
                          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 'bold' }}>₹{item.price.toFixed(2)}</div>
                        </div>
                        {token && user?.role === 'customer' && !isSoldOut && (
                          <button onClick={() => addToCart(item)} style={{ padding: '6px 14px', fontSize: 12, background: inCart ? '#2563eb' : '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {inCart ? '+ More' : '+ Add'}
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                        {isSoldOut && (
                          <span style={{ color: '#b91c1c', fontWeight: 'bold', background: '#fee2e2', padding: '2px 6px', borderRadius: 3 }}>SOLD OUT</span>
                        )}
                        {inCart && (
                          <span style={{ color: '#2563eb', fontWeight: 'bold', background: '#dbeafe', padding: '2px 6px', borderRadius: 3 }}>✓ In cart ({inCart.quantity})</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'order' && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Your Order</h4>
            {cart.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 12 }}>
                <p>Your cart is empty</p>
                <button onClick={() => setActiveTab('menu')} style={{ padding: '6px 12px', fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  Browse Menu
                </button>
              </div>
            ) : (
              <form onSubmit={submitOrder}>
                <div style={{ marginBottom: 12 }}>
                  {cart.map(item => (
                    <div key={item.menuItem} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: 8, background: '#f9fafb', borderRadius: 4 }}>
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>₹{item.unitPrice.toFixed(2)} each</div>
                      </div>
                      <input type="number" min={0} value={item.quantity} onChange={e => updateQty(item.menuItem, Number(e.target.value))} style={{ width: 50, padding: 4, fontSize: 12 }} />
                      <div style={{ fontSize: 12, fontWeight: 'bold', minWidth: 60, textAlign: 'right' }}>
                        ₹{(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
                    <span>Total:</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <textarea placeholder="Special instructions (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ width: '100%', padding: 8, fontSize: 12, minHeight: 60, borderRadius: 4, border: '1px solid #ddd' }} />
                </div>

                <button type="submit" disabled={submitting || cart.length === 0} style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
                  {submitting ? 'Placing Order...' : `Place Order (₹${total.toFixed(2)})`}
                </button>

                {success && (
                  <div style={{ marginTop: 8, padding: 8, background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 12 }}>
                    ✓ Order placed successfully!
                  </div>
                )}
                {error && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fee2e2', color: '#b91c1c', borderRadius: 4, fontSize: 12 }}>
                    {error}
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getMarkerIcon(status) {
  const svgMarker = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='${status === 'active' ? '%2316a34a' : '%23ef4444'}' /%3E%3C/svg%3E`;
  return svgMarker;
}

const th = { textAlign:'left', padding:6, background:'#f5f5f5', fontSize:12 };
const td = { padding:6, fontSize:13 };
