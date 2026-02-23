import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import gsap from 'gsap';

export default function Orders() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api.getOrders(token)
      .then(res => {
        if (mounted && res.success) {
          // Sort by date desc
          const sorted = (res.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setOrders(sorted);
        }
      })
      .catch(err => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    if (!loading && orders.length > 0 && listRef.current) {
      gsap.fromTo(listRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [loading, orders]);

  const activeOrders = useMemo(() => orders.filter(o => !['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(o.status)), [orders]);
  const pastOrders = useMemo(() => orders.filter(o => ['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(o.status)), [orders]);

  if (loading) return <div className="flex-center" style={{ height: '50vh', color: 'var(--text-secondary)' }}>Loading Orders...</div>;

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '30px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 30 }}>
        <h1 className="text-gradient" style={{ margin: 0 }}>Your Orders</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Track current deliveries and view history.</p>
      </div>

      {orders.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🥡</div>
          <h3 style={{ color: 'var(--text-primary)' }}>No orders yet</h3>
          <p>Hungry? Find a truck near you!</p>
          <Link to="/trucks" style={{
            display: 'inline-block',
            marginTop: 20,
            background: 'var(--primary)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 30,
            fontWeight: 600,
            textDecoration: 'none'
          }}>
            Find Food Trucks
          </Link>
        </div>
      )}

      {activeOrders.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            Active Orders
          </h3>
          <div ref={listRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {activeOrders.map(order => (
              <OrderCard key={order._id || order.id} order={order} active />
            ))}
          </div>
        </div>
      )}

      {pastOrders.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>Past Orders</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, opacity: 0.8 }}>
            {pastOrders.map(order => (
              <OrderCard key={order._id || order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, active }) {
  const navigate = useNavigate();
  const statusBadges = {
    PLACED: 'badge-blue',
    ACCEPTED: 'badge-purple',
    PREPARING: 'badge-yellow',
    READY: 'badge-green',
    COMPLETED: 'badge-green',
    CANCELLED: 'badge-red'
  };

  const status = order.status || 'PLACED';
  const badgeClass = statusBadges[status] || 'badge-blue';
  const truckName = typeof order.truck === 'object' ? order.truck.name : 'Food Truck';

  return (
    <div
      className="card"
      onClick={() => navigate(`/orders/${order._id || order.id}`)}
      style={{
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{truckName}</h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {new Date(order.createdAt).toLocaleDateString()} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <span className={`badge ${badgeClass}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800 }}>
          {status}
        </span>
      </div>

      <div style={{ margin: '20px 0', padding: '15px 0', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
            {order.items.map(i => i.name).join(', ')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>{formatCurrency(order.total)}</span>
        {active ? (
          <span className="text-gradient" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Track →</span>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>View Details</span>
        )}
      </div>
    </div>
  );
}
