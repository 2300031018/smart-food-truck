import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import MapEmbed from '../components/MapEmbed';
import { useSocketRooms } from '../hooks/useSocketRooms';
import { formatCurrency } from '../utils/currency';
import gsap from 'gsap';

export default function TruckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  // Data State
  const [truck, setTruck] = useState(null);
  const [menu, setMenu] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Interaction State
  const [cart, setCart] = useState({});
  const [notes, setNotes] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  const heroRef = useRef(null);
  const menuRef = useRef(null);

  // Initial Fetch
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.getTruck(id),
      api.getMenuItems(id, { all: true }),
      api.getRecommendations(id)
    ]).then(([truckRes, menuRes, recRes]) => {
      if (mounted) {
        if (truckRes.success) setTruck(truckRes.data);
        if (menuRes.success) setMenu(menuRes.data);
        if (recRes.success) setRecs(recRes.data);
      }
    }).catch(err => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [id]);

  // Animations
  useEffect(() => {
    if (!loading && truck) {
      gsap.fromTo(heroRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
      );
      if (menuRef.current) {
        gsap.fromTo(menuRef.current.children,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out", delay: 0.2 }
        );
      }
    }
  }, [loading, truck]);

  // Restore Cart
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sft_pending_order');
      if (saved) {
        const { truckId, cart: savedCart, notes: savedNotes } = JSON.parse(saved);
        if (truckId === id) {
          setCart(savedCart || {});
          setNotes(savedNotes || '');
          localStorage.removeItem('sft_pending_order');
        }
      }
    } catch (e) { console.warn('Failed to restore cart', e); }
  }, [id]);

  // Socket Logic
  const handleLocation = useCallback((payload) => {
    if (!payload?.truckId || payload.truckId !== (truck?.id || truck?._id)) return;
    setTruck(prev => ({
      ...prev,
      liveLocation: payload.liveLocation,
      status: payload.status ?? prev?.status
    }));
  }, [truck]);

  const listeners = useMemo(() => ({ 'truck:location': handleLocation }), [handleLocation]);
  const rooms = useMemo(() => (id ? [`truck:${id}`] : []), [id]);
  useSocketRooms({ token, rooms, listeners, enabled: Boolean(token && id && truck) });

  // Location Updates (Owner/Admin)
  const canUpdateLocation = token && (user?.role === 'admin' || (truck?.manager && (truck.manager.id === user.id || truck.manager.id === user._id)));

  const updateLocation = () => {
    if (!('geolocation' in navigator)) return alert('Geolocation not supported');
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        await api.updateTruckStatusLocation(token, id, {
          liveLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        });
        alert('Location updated!');
      } catch (e) { console.error(e); }
      finally { setLocBusy(false); }
    }, err => { alert(err.message); setLocBusy(false); });
  };

  // Cart Functions
  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([itemId, qty]) => {
      const item = menu.find(m => m._id === itemId);
      return item ? { ...item, quantity: qty } : null;
    }).filter(Boolean);
  }, [cart, menu]);

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (item) => setCart(p => ({ ...p, [item._id]: (p[item._id] || 0) + 1 }));
  const removeFromCart = (itemId) => setCart(p => {
    const next = { ...p };
    if (next[itemId] > 1) next[itemId]--;
    else delete next[itemId];
    return next;
  });

  async function handlePlaceOrder() {
    if (!token) {
      localStorage.setItem('sft_pending_order', JSON.stringify({ truckId: id, cart, notes }));
      return navigate('/login');
    }
    setOrdering(true);
    try {
      await api.createOrder(token, {
        truck: id,
        items: cartItems.map(it => ({ menuItem: it._id, quantity: it.quantity })),
        notes
      });
      setCart({});
      setNotes('');
      navigate('/orders');
    } catch (e) {
      alert(e.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  }

  if (loading) return <div className="flex-center" style={{ height: '50vh', color: 'var(--text-secondary)' }}>Loading Truck...</div>;
  if (error || !truck) return <div className="container" style={{ padding: 20, color: 'var(--danger)' }}>{error || 'Truck not found'}</div>;

  return (
    <div style={{ paddingBottom: 100, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Hero Section */}
      <div
        ref={heroRef}
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), var(--bg-primary)), url(/images/hero-bg.png) center/cover no-repeat',
          padding: '120px 0 80px',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0%, var(--bg-primary) 100%)',
          pointerEvents: 'none'
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 60 }}>
            <div style={{ flex: 1, minWidth: 350 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{
                  background: ['SERVING', 'OPEN'].includes(truck.status) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: ['SERVING', 'OPEN'].includes(truck.status) ? 'var(--success)' : 'var(--danger)',
                  padding: '6px 16px',
                  borderRadius: 30,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  border: '1px solid currentColor'
                }}>
                  {truck.status === 'SERVING' || truck.status === 'OPEN' ? '🟢 SERVING NOW' : '🔴 CLOSED'}
                </span>
                {canUpdateLocation && (
                  <button
                    onClick={updateLocation}
                    disabled={locBusy}
                    style={{
                      background: 'rgba(0,0,0,0.03)',
                      color: 'var(--text-primary)',
                      padding: '6px 16px',
                      borderRadius: 30,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    {locBusy ? 'Updating...' : '📍 Update GPS'}
                  </button>
                )}
              </div>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: 20, lineHeight: 1, fontWeight: 900 }}>{truck.name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: 650, lineHeight: 1.8, marginBottom: 32, fontWeight: 500 }}>{truck.description}</p>

              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Cuisine</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{truck.cuisine || 'Street Gourmet'}</div>
                </div>
                <div style={{ width: 1, background: '#e2e8f0' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Wait Time</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 701, color: '#0f172a' }}>~15 Mins</div>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: 500, height: 320, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
              <MapEmbed
                height={320}
                routePlan={truck.routePlan}
                currentStopIndex={truck.currentStopIndex}
                status={truck.status}
                liveLocation={truck.liveLocation || truck.location}
                truckId={truck.id || truck._id}
                rounded={false}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ marginTop: 60 }}>

        {/* Recommendations */}
        {recs.length > 0 && (
          <div style={{ marginBottom: 60 }}>
            <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.5rem', fontWeight: 800 }}>
              <span style={{ fontSize: '1.5rem' }}>✨</span> Chefs Choice
            </h3>
            <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 15 }}>
              {recs.map(r => {
                const item = menu.find(m => m.name === r.name);
                if (!item) return null;
                return (
                  <div
                    key={r.name}
                    className="glass-panel"
                    style={{
                      minWidth: 260,
                      padding: 24,
                      cursor: 'pointer',
                      border: '1px solid rgba(0,0,0,0.03)'
                    }}
                    onClick={() => addToCart(item)}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8, fontSize: '1.1rem' }}>{r.name}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tap to add pairing +</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Menu Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, borderBottom: '1px solid #e2e8f0', paddingBottom: 20 }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a' }}>Full Menu</h2>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{menu.length} Items Available</div>
        </div>

        <div
          ref={menuRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 30
          }}
        >
          {menu.map(item => (
            <div
              key={item._id}
              className="glass-panel"
              style={{
                borderRadius: 24,
                opacity: item.isAvailable ? 1 : 0.6,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid rgba(0,0,0,0.04)',
                minHeight: 240
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 800, color: '#0f172a' }}>{item.name}</h3>
                  <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary)' }}>{formatCurrency(item.price)}</span>
                </div>

                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6, fontWeight: 500 }}>
                  {item.category || 'Kitchen Specialty'} &bull; Crafted Fresh
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {!item.isAvailable ? (
                  <span style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(239, 68, 68, 0.05)', padding: '6px 16px', borderRadius: 20 }}>SOLD OUT FOR TODAY</span>
                ) : (
                  cart[item._id] ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 20,
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(0,0,0,0.05)',
                      borderRadius: 50,
                      padding: '8px 16px'
                    }}>
                      <button onClick={() => removeFromCart(item._id)} style={{ color: 'var(--text-secondary)', fontSize: '1.6rem', padding: '0 5px', background: 'transparent', fontWeight: 800 }}>&minus;</button>
                      <span style={{ fontWeight: 800, color: '#0f172a', minWidth: 20, textAlign: 'center', fontSize: '1.1rem' }}>{cart[item._id]}</span>
                      <button onClick={() => addToCart(item)} style={{ color: 'var(--primary)', fontSize: '1.6rem', padding: '0 5px', background: 'transparent', fontWeight: 800 }}>+</button>
                    </div>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => addToCart(item)}
                      style={{ padding: '10px 24px', fontSize: '0.95rem', width: '100%' }}
                    >
                      Add to Order
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Order Bar */}
      {totalItems > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '95%',
            maxWidth: 700,
            zIndex: 1000
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '24px 32px',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(255, 107, 107, 0.1)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.15)',
              borderRadius: 30,
              backdropFilter: 'blur(30px)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{totalItems}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Review Your Order</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{cartItems.map(it => it.name).join(', ')}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Subtotal</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>{formatCurrency(cartTotal)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <input
                placeholder="Allergies or special instructions?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ flex: 1, padding: '14px 24px' }}
              />
              <button
                className="btn-primary"
                onClick={handlePlaceOrder}
                disabled={ordering}
                style={{
                  padding: '14px 40px',
                  fontSize: '1rem',
                  textTransform: 'none'
                }}
              >
                {ordering ? 'Sending...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
