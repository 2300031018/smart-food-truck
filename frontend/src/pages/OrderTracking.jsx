import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { useSocketRooms } from '../hooks/useSocketRooms';
import MapEmbed from '../components/MapEmbed';
import gsap from 'gsap';

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

const STEP_INFO = {
    PLACED: { label: 'Order Placed', icon: '📝', desc: 'Waiting for restaurant confirmation' },
    ACCEPTED: { label: 'Order Accepted', icon: '👩‍🍳', desc: 'Chef has received your order' },
    PREPARING: { label: 'Cooking', icon: '🔥', desc: 'Your food is getting sizzled' },
    READY: { label: 'Ready for Pickup', icon: '🎁', desc: 'It’s waiting for you at the truck!' },
    COMPLETED: { label: 'Enjoy!', icon: '😋', desc: 'Order completed' },
    CANCELLED: { label: 'Cancelled', icon: '❌', desc: 'This order was cancelled' }
};

function normalizeStatus(status) {
    const map = { PENDING: 'PLACED', PLACED: 'PLACED', ACCEPTED: 'ACCEPTED', PREPARING: 'PREPARING', READY: 'READY', DELIVERED: 'COMPLETED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' };
    return map[String(status || '').toUpperCase()] || String(status || '').toUpperCase();
}

export default function OrderTracking() {
    const { id } = useParams();
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [truck, setTruck] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [updating, setUpdating] = useState(false);

    const containerRef = useRef(null);
    const statusRef = useRef(null);

    // Fetch Order & Truck
    useEffect(() => {
        if (!token || !id) return;
        let mounted = true;
        api.getOrder(token, id)
            .then(async (res) => {
                if (res.success && mounted) {
                    setOrder(res.data);
                    // Fetch truck for location
                    if (res.data.truck) {
                        try {
                            const truckId = typeof res.data.truck === 'string' ? res.data.truck : res.data.truck.id || res.data.truck._id;
                            const tRes = await api.getTruck(truckId);
                            if (tRes.success && mounted) setTruck(tRes.data);
                        } catch (e) { console.error('Failed to load truck loc', e); }
                    }
                }
            })
            .catch(err => mounted && setError(err.message || 'Order not found'))
            .finally(() => mounted && setLoading(false));

        return () => { mounted = false; };
    }, [token, id]);

    // Animations
    useEffect(() => {
        if (!loading && order) {
            gsap.fromTo(containerRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
            gsap.fromTo(statusRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, delay: 0.3, ease: 'back.out(1.7)' });
        }
    }, [loading, order]);

    // Real-time updates
    const rooms = order ? [`order:${id}`] : [];
    useSocketRooms(rooms, useCallback((event, payload) => {
        if ((event === 'order:update' || event === 'order:new') && payload.orderId === id) {
            setOrder(prev => prev ? { ...prev, ...payload.order, status: payload.status || payload.order?.status } : prev);
        }
    }, [id]));

    // Truck Location Utils
    const truckRooms = truck ? [`truck:${truck.id || truck._id}`] : [];
    useSocketRooms({
        token, rooms: truckRooms, enabled: !!truck, listeners: {
            'truck:location': (payload) => {
                if (payload.truckId === (truck.id || truck._id)) {
                    setTruck(t => ({ ...t, liveLocation: payload.liveLocation }));
                }
            }
        }
    });

    const handleCancel = async () => {
        if (!window.confirm('Cancel this order?')) return;
        setCancelling(true);
        try {
            const res = await api.updateOrderStatus(token, id, 'CANCELLED');
            if (res.success) setOrder(res.data);
        } catch (err) { alert(err.message); }
        finally { setCancelling(false); }
    };

    const updateStatus = async (status, reason) => {
        setUpdating(true);
        try {
            const res = await api.updateOrderStatus(token, id, status, reason);
            if (res.success) setOrder(res.data);
        } catch (err) { alert(err.message); }
        finally { setUpdating(false); }
    };

    if (loading) return <div className="flex-center" style={{ height: '60vh', color: 'var(--text-secondary)' }}>Finding order...</div>;
    if (error || !order) return <div className="container" style={{ padding: 40, textAlign: 'center' }}><h3>Order not found</h3><Link to="/orders" className="text-gradient">Back to Orders</Link></div>;

    const status = normalizeStatus(order.status);
    const info = STEP_INFO[status] || STEP_INFO.PLACED;
    const isCancelled = status === 'CANCELLED';
    const stepIndex = STEPS.indexOf(status);
    const progress = Math.max(0, (stepIndex / (STEPS.length - 1)) * 100);

    return (
        <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
            <div className="container" ref={containerRef} style={{ paddingBottom: 60 }}>
                {/* Header */}
                <div style={{ padding: '30px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link to="/orders" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <span style={{ fontSize: '1.2rem' }}>←</span> All Orders
                    </Link>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(0,0,0,0.03)', padding: '4px 12px', borderRadius: '20px' }}>ID: {id.slice(-8).toUpperCase()}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 48, alignItems: 'start' }}>

                    {/* Status Column */}
                    <div>
                        <div ref={statusRef} className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center', marginBottom: 32, border: '1px solid rgba(0,0,0,0.03)', background: '#fff' }}>
                            <div style={{ fontSize: '6rem', marginBottom: 24 }}>{info.icon}</div>
                            <h1 className="text-gradient" style={{ fontSize: '3.5rem', marginBottom: 16, fontWeight: 900, lineHeight: 1 }}>{info.label}</h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 500, maxWidth: 400, margin: '0 auto' }}>{info.desc}</p>

                            {!isCancelled && (
                                <div style={{ marginTop: 60, padding: '0 40px' }}>
                                    <div style={{ position: 'relative', height: 10, background: 'rgba(0,0,0,0.03)', borderRadius: 20 }}>
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, height: '100%',
                                            width: `${progress}%`,
                                            background: 'var(--primary)',
                                            borderRadius: 20,
                                            boxShadow: '0 4px 15px rgba(255, 107, 107, 0.3)',
                                            transition: 'width 2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: `${progress}%`,
                                            transform: 'translate(-50%, -50%)',
                                            width: 20, height: 20, borderRadius: '50%',
                                            background: '#fff',
                                            border: '4px solid var(--primary)',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                                            transition: 'left 2s cubic-bezier(0.19, 1, 0.22, 1)'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
                                        <span>Ordered</span>
                                        <span>Cooking</span>
                                        <span>Ready</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Staff / Manager Actions */}
                        {['admin', 'manager', 'staff'].includes(user?.role) && !isCancelled && status !== 'COMPLETED' && (
                            <div className="glass-panel" style={{ marginTop: 32, padding: 32, border: '2px solid var(--primary)', background: 'rgba(255, 107, 107, 0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                    <span style={{ fontSize: '1.4rem' }}>🛠️</span>
                                    <h4 style={{ margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1rem', fontWeight: 900 }}>Staff Controls</h4>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    {status === 'PLACED' && (
                                        <button className="btn-primary" onClick={() => updateStatus('ACCEPTED')} disabled={updating}>
                                            {updating ? 'Updating...' : 'Accept Order'}
                                        </button>
                                    )}
                                    {status === 'ACCEPTED' && (
                                        <button className="btn-primary" onClick={() => updateStatus('PREPARING')} disabled={updating}>
                                            {updating ? 'Updating...' : 'Start Cooking'}
                                        </button>
                                    )}
                                    {status === 'PREPARING' && (
                                        <button className="btn-primary" onClick={() => updateStatus('READY')} disabled={updating}>
                                            {updating ? 'Updating...' : 'Ready for Pickup'}
                                        </button>
                                    )}
                                    {status === 'READY' && (
                                        <button className="btn-primary" style={{ background: 'var(--success)', border: 'none' }} onClick={() => updateStatus('COMPLETED')} disabled={updating}>
                                            {updating ? 'Updating...' : 'Mark Delivered'}
                                        </button>
                                    )}

                                    <button
                                        className="btn"
                                        disabled={updating}
                                        style={{ background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '50px', fontWeight: 700 }}
                                        onClick={() => {
                                            const reason = window.prompt('Enter cancellation reason:');
                                            if (reason !== null) updateStatus('CANCELLED', reason);
                                        }}
                                    >
                                        {updating ? 'Updating...' : 'Cancel Order'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Pickup Information Card */}
                        <div className="glass-panel" style={{ marginTop: 32, padding: 32, border: '1px solid rgba(0,0,0,0.03)', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                <span style={{ fontSize: '1.4rem' }}>📍</span>
                                <h4 style={{ margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1rem', fontWeight: 900 }}>Pickup Location</h4>
                            </div>

                            {truck?.routePlan?.stops?.find(s => s._id === order.pickupStopId || s.id === order.pickupStopId) ? (
                                (() => {
                                    const stop = truck.routePlan.stops.find(s => s._id === order.pickupStopId || s.id === order.pickupStopId);
                                    return (
                                        <>
                                            <div style={{ marginBottom: 24 }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>{stop.name}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>{stop.address || 'Scheduled Route Stop'}</div>
                                            </div>
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-primary"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    fontSize: '0.95rem',
                                                    textDecoration: 'none'
                                                }}
                                            >
                                                🚗 Get Directions
                                            </a>
                                        </>
                                    );
                                })()
                            ) : (
                                <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500, lineHeight: 1.6 }}>
                                    Your order is being prepared at the current {truck?.name || 'food truck'} location. Head over to grab it!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Map & Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                        {/* Map Segment */}
                        <div style={{ minHeight: 450, position: 'relative' }}>
                            {truck ? (
                                <div className="glass-panel" style={{ height: 450, padding: 0, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)', boxShadow: 'var(--shadow-lg)' }}>
                                    <MapEmbed
                                        height="450px"
                                        routePlan={truck.routePlan}
                                        currentStopIndex={truck.currentStopIndex}
                                        status={truck.status}
                                        liveLocation={truck.liveLocation || truck.location}
                                        truckId={truck.id || truck._id}
                                        rounded={false}
                                    />
                                </div>
                            ) : (
                                <div className="glass-panel" style={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🌍</div>
                                        <div style={{ fontWeight: 600 }}>Locating Truck...</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Order Details */}
                        <div className="glass-panel" style={{ padding: 32, background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Items</h3>
                                <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    background: 'rgba(0,0,0,0.05)',
                                    color: 'var(--text-primary)',
                                    textTransform: 'uppercase'
                                }}>{status}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {order.items.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 500 }}>
                                        <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: '#0f172a', fontWeight: 800 }}>{item.quantity}x</strong> {item.name}</span>
                                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(item.lineTotal)}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '1.6rem', fontWeight: 900 }}>
                                <span style={{ color: '#0f172a' }}>Total</span>
                                <span style={{ color: 'var(--primary)' }}>{formatCurrency(order.total)}</span>
                            </div>
                            {order.notes && (
                                <div style={{ marginTop: 24, padding: 20, background: 'rgba(255, 107, 107, 0.03)', borderRadius: 16, fontSize: '0.95rem', color: 'var(--text-secondary)', fontStyle: 'italic', border: '1px solid rgba(255, 107, 107, 0.1)', lineHeight: 1.6 }}>
                                    " {order.notes} "
                                </div>
                            )}

                            {status === 'PLACED' && user?.role === 'customer' && !isCancelled && (
                                <button
                                    onClick={handleCancel}
                                    disabled={cancelling}
                                    style={{
                                        marginTop: 32, width: '100%', padding: '16px', borderRadius: '50px',
                                        background: 'transparent', border: '2px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)',
                                        cursor: 'pointer', fontWeight: 800, transition: 'all 0.3s ease',
                                        fontSize: '1rem'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                                        e.currentTarget.style.borderColor = 'var(--danger)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                    }}
                                >
                                    {cancelling ? 'Sending Request...' : 'Cancel Order'}
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
