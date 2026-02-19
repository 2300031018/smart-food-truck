import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { useSocketRooms } from '../hooks/useSocketRooms';

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

const STEP_LABELS = {
    PLACED: 'Order Placed',
    ACCEPTED: 'Order Accepted',
    PREPARING: 'Being Prepared',
    READY: 'Ready for Pickup! 🎉',
    COMPLETED: 'Completed ✅',
    CANCELLED: 'Cancelled ❌'
};

const STEP_ICONS = {
    PLACED: '📋',
    ACCEPTED: '👍',
    PREPARING: '👨‍🍳',
    READY: '🛎️',
    COMPLETED: '✅',
    CANCELLED: '❌'
};

const STEP_DESCRIPTIONS = {
    PLACED: 'Your order is waiting to be accepted by the kitchen.',
    ACCEPTED: 'Great! The kitchen has accepted your order.',
    PREPARING: 'Your food is being prepared right now.',
    READY: 'Your order is ready! Head to the truck to pick it up.',
    COMPLETED: 'Order complete. Enjoy your meal!',
    CANCELLED: 'This order was cancelled.'
};

function normalizeStatus(status) {
    const map = { PENDING: 'PLACED', PLACED: 'PLACED', ACCEPTED: 'ACCEPTED', PREPARING: 'PREPARING', READY: 'READY', DELIVERED: 'COMPLETED', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' };
    return map[String(status || '').toUpperCase()] || String(status || '').toUpperCase();
}

function StepTracker({ status }) {
    const normalized = normalizeStatus(status);
    const isCancelled = normalized === 'CANCELLED';
    const currentIndex = STEPS.indexOf(normalized);

    if (isCancelled) {
        return (
            <div style={{ textAlign: 'center', padding: '32px 20px', background: '#fff1f2', borderRadius: 12, border: '1px solid #fda4af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                <h3 style={{ color: '#be123c', margin: 0 }}>Order Cancelled</h3>
                <p style={{ color: '#64748b', marginTop: 8 }}>{STEP_DESCRIPTIONS.CANCELLED}</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 0' }}>
            {/* Current status hero */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 56, marginBottom: 8 }}>{STEP_ICONS[normalized] || '📋'}</div>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: 22 }}>{STEP_LABELS[normalized] || normalized}</h2>
                <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>{STEP_DESCRIPTIONS[normalized]}</p>
            </div>

            {/* Step bar */}
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', padding: '0 12px' }}>
                {STEPS.map((step, i) => {
                    const isDone = i < currentIndex;
                    const isCurrent = i === currentIndex;
                    const color = isDone ? '#10b981' : isCurrent ? '#6366f1' : '#e2e8f0';
                    const textColor = isDone || isCurrent ? '#1e293b' : '#94a3b8';
                    return (
                        <React.Fragment key={step}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16, fontWeight: 700, color: 'white',
                                    boxShadow: isCurrent ? '0 0 0 4px #c7d2fe' : 'none',
                                    transition: 'all 0.3s'
                                }}>
                                    {isDone ? '✓' : i + 1}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 11, color: textColor, textAlign: 'center', fontWeight: isCurrent ? 600 : 400 }}>
                                    {STEP_LABELS[step]}
                                </div>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div style={{ flex: 1, height: 3, background: i < currentIndex ? '#10b981' : '#e2e8f0', transition: 'background 0.5s', marginBottom: 24 }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

export default function OrderTracking() {
    const { id } = useParams();
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    // Fetch order
    useEffect(() => {
        if (!token || !id) return;
        setLoading(true);
        api.getOrder(token, id)
            .then(res => { if (res.success) setOrder(res.data); })
            .catch(err => setError(err.message || 'Order not found'))
            .finally(() => setLoading(false));
    }, [token, id]);

    // Real-time updates
    const rooms = order ? [`order:${id}`] : [];
    useSocketRooms(rooms, useCallback((event, payload) => {
        if ((event === 'order:update' || event === 'order:new') && payload.orderId === id) {
            setOrder(prev => prev ? { ...prev, ...payload.order, status: payload.status || payload.order?.status } : prev);
        }
    }, [id]));

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel this order?')) return;
        setCancelling(true);
        try {
            const res = await api.updateOrderStatus(token, id, 'CANCELLED');
            if (res.success) setOrder(res.data);
        } catch (err) {
            alert(err.message || 'Failed to cancel');
        } finally {
            setCancelling(false);
        }
    };

    if (loading) return (
        <div style={{ padding: 40, textAlign: 'center', color: '#6366f1' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading your order...
        </div>
    );

    if (error || !order) return (
        <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
            <p style={{ color: '#64748b' }}>{error || 'Order not found'}</p>
            <Link to="/orders" style={{ color: '#6366f1' }}>← Back to Orders</Link>
        </div>
    );

    const status = normalizeStatus(order.status);
    const canCancel = status === 'PLACED' && user?.role === 'customer';
    const isActive = !['COMPLETED', 'CANCELLED'].includes(status);

    return (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button onClick={() => navigate('/orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6366f1' }}>←</button>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, color: '#1e293b' }}>Track Your Order</h1>
                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>#{id.slice(-8).toUpperCase()}</p>
                </div>
                {isActive && (
                    <span style={{ marginLeft: 'auto', background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        🟢 Live
                    </span>
                )}
            </div>

            {/* Step Tracker */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgb(0 0 0 / 0.1)', marginBottom: 20 }}>
                <StepTracker status={status} />
            </div>

            {/* Order Items */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgb(0 0 0 / 0.1)', marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 16 }}>Your Items</h3>
                {(order.items || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < order.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <span style={{ color: '#334155' }}>{item.quantity}× {item.name}</span>
                        <span style={{ color: '#64748b', fontWeight: 500 }}>{formatCurrency(item.lineTotal)}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>Total</span>
                    <span style={{ fontWeight: 700, color: '#6366f1', fontSize: 18 }}>{formatCurrency(order.total)}</span>
                </div>
                {order.notes && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#64748b' }}>
                        📝 {order.notes}
                    </div>
                )}
            </div>

            {/* Cancel button */}
            {canCancel && (
                <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #fda4af', background: '#fff1f2', color: '#be123c', cursor: cancelling ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 15 }}
                >
                    {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </button>
            )}
        </div>
    );
}
