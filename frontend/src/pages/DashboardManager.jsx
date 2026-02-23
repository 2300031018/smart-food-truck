import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ManagerMenuPanel from '../components/manager/ManagerMenuPanel';
import RouteEditorModal from '../components/RouteEditorModal';
import TruckFormModal from '../components/TruckFormModal';
import { clearRoutePathsForTruck } from '../utils/routePathCache';
import { useSocketRooms } from '../hooks/useSocketRooms';
import SmartInsights from '../components/SmartInsights';
import ForecastPanel from '../components/manager/ForecastPanel';

export default function DashboardManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('sft_token');
  const [trucks, setTrucks] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', truckId: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState([]);
  const [orderCount, setOrderCount] = useState(0);
  const [editingTruck, setEditingTruck] = useState(null); // Route Editor
  const [editingDetails, setEditingDetails] = useState(null); // Details Editor (Create/Edit)
  const [busyId, setBusyId] = useState(null);
  const [insightId, setInsightId] = useState(null);

  useEffect(() => { api.getManagedTrucks(token).then(d => { if (d.success) setTrucks(d.data); }); }, [token]);

  const handleOrderNew = useCallback(() => setOrderCount(c => c + 1), []);
  const handleTruckDeleted = useCallback(({ truckId }) => {
    if (!truckId) return;
    setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
    setEditingTruck(prev => (prev && (prev.id || prev._id) === truckId ? null : prev));
    setEditingDetails(prev => (prev && (prev.id || prev._id) === truckId ? null : prev));
    clearRoutePathsForTruck(truckId);
  }, []);

  const rooms = useMemo(() => (user?.id ? [`orders:manager:${user.id}`] : []), [user?.id]);
  const listeners = useMemo(() => ({
    'order:new': handleOrderNew,
    'truck:deleted': handleTruckDeleted
  }), [handleOrderNew, handleTruckDeleted]);
  useSocketRooms({ token, rooms, listeners, enabled: Boolean(token) });

  async function submit(e) {
    e.preventDefault(); setError(null); setCreating(true);
    try {
      const data = await api.createStaff(token, form);
      if (data.success) setStaff(s => [...s, data.data]);
      setForm({ name: '', email: '', password: '', truckId: '' });
    } catch (e) { setError(e.message); } finally { setCreating(false); }
  }

  async function handleDeleteTruck(truckId) {
    if (!window.confirm('Are you sure you want to delete this truck?')) return;
    setBusyId(truckId);
    try {
      await api.deleteTruck(token, truckId);
      setTrucks(prev => prev.filter(t => (t.id || t._id) !== truckId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function handleCreateSuccess(newTruck) {
    setTrucks(prev => [...prev, newTruck]);
    // No longer opening RouteEditorModal here as it's part of the creation wizard
  }

  return (
    <div className="dashboard-container">
      <div className="page-header" style={{ marginBottom: 30 }}>
        <div>
          <h2 className="text-gradient">Manager Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 5 }}>Manage your fleet, staff, and menus.</p>
        </div>
        <div className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
          Example Stat: {orderCount} New Orders
        </div>
      </div>

      <div className="card" style={{ padding: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>Create Staff</h3>
          <button 
            className="btn btn-sm"
            onClick={() => navigate('/manager/staff')}
            style={{ 
              background: '#f8fafc', 
              color: '#334155', 
              border: '1px solid #cbd5e1', 
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>👥</span> View & Manage All Staff
          </button>
        </div>
        <p style={{ marginBottom: 25, color: 'var(--text-secondary)' }}>Create a new staff account and assign them to one of your trucks.</p>
        
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'end' }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Name</label>
            <input 
              className="form-control"
              placeholder='e.g. John Doe' 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
              required 
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
            />
          </div>
          
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Email</label>
            <input 
              className="form-control"
              placeholder='staff@example.com' 
              type='email' 
              value={form.email} 
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
              required 
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Password</label>
            <input 
              className="form-control"
              placeholder='••••••••' 
              type='password' 
              value={form.password} 
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
              required 
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Assign Truck</label>
            <select 
              className="form-control"
              value={form.truckId} 
              onChange={e => setForm(f => ({ ...f, truckId: e.target.value }))} 
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}
            >
              <option value=''>Select Truck...</option>
              {trucks.map(t => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <button className="btn btn-primary" disabled={creating} style={{ 
              width: '100%', 
              height: 42, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'var(--primary, #ef4444)',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
              border: 'none',
              cursor: 'pointer'
            }}>
              {creating ? 'Creating...' : 'Create Staff Account'}
            </button>
          </div>
        </form>
        {error && <div style={{ color: '#ef4444', marginTop: 15, padding: 10, background: 'rgba(239,68,68,0.05)', borderRadius: 6, fontWeight: 500 }}>{error}</div>}

        {staff.length > 0 && (
          <div style={{ marginTop: 25, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <h4 style={{ marginBottom: 15, color: '#334155' }}>Recently Created</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {staff.map((s, i) => (
                <div key={i} className="" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '8px 14px', 
                  background: '#dcfce7', 
                  color: '#166534', 
                  borderRadius: 20,
                  fontSize: '0.85rem'
                }}>
                  <span>👤</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{s.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 30, padding: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, flexWrap: 'wrap', gap: 15 }}>
          <div>
            <h3 style={{ margin: 0 }}>My Trucks</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: 14, color: '#64748b' }}>Manage your food trucks and their routes.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setEditingDetails({})} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            background: 'var(--primary, #ef4444)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer'
          }}>
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Add New Truck
          </button>
        </div>

        <div className="truck-list">
          {trucks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No trucks assigned yet.</p>
              <button className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={() => setEditingDetails({})}>Create your first truck</button>
            </div>
          )}
          {trucks.map(t => {
            const tid = t.id || t._id;
            return (
              <div key={tid} style={{ 
                border: '1px solid var(--border-color)', 
                borderRadius: 12, 
                padding: 24, 
                marginBottom: 20, 
                background: 'var(--bg-secondary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 20 }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>{t.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 6, 
                        padding: '4px 10px', borderRadius: 20, 
                        background: t.status === 'OPEN' || t.status === 'SERVING' ? 'var(--success-bg)' : 'rgba(0,0,0,0.05)',
                        color: t.status === 'OPEN' || t.status === 'SERVING' ? 'var(--success)' : 'var(--text-secondary)',
                        fontSize: '0.85rem', fontWeight: 600 
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>
                        {t.status}
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>📍 {t.location?.address || 'No location set'}</span>
                    </div>
                  </div>

                    <div className="btn-group" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" style={{ background: '#fff', color: '#0ea5e9', border: '1px solid #0ea5e9' }} onClick={() => setInsightId(insightId === tid ? null : tid)}>
                      {insightId === tid ? 'Hide Insights' : '📊 Smart Insights'}
                    </button>
                    <button className="btn btn-sm" style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} onClick={() => setEditingDetails(t)}>
                      ✏️ Edit Details
                    </button>
                    <button className="btn btn-sm" style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1' }} onClick={() => setEditingTruck(t)}>
                      🗺️ Edit Route
                    </button>
                    <button className="btn btn-sm" style={{ background: '#ffffff', color: '#ef4444', border: '1px solid #ef4444' }} disabled={busyId === tid} onClick={() => handleDeleteTruck(tid)}>
                      {busyId === tid ? '...' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>
                
                {insightId === tid && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
                    <SmartInsights truckId={tid} token={token} onboardClose={() => setInsightId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ManagerMenuPanel trucks={trucks} />

      {trucks.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <ForecastPanel trucks={trucks} />
        </div>
      )}

      {editingDetails && (
        <TruckFormModal
          truck={editingDetails.id || editingDetails._id ? editingDetails : null}
          token={token}
          onClose={() => setEditingDetails(null)}
          onSave={() => api.getManagedTrucks(token).then(d => { if (d.success) setTrucks(d.data); })}
          onSuccess={(newTruck) => !(editingDetails.id || editingDetails._id) && handleCreateSuccess(newTruck)}
        />
      )}

      {editingTruck && (
        <RouteEditorModal
          truck={editingTruck}
          token={token}
          onClose={() => setEditingTruck(null)}
          onSave={() => api.getManagedTrucks(token).then(d => { if (d.success) setTrucks(d.data); })}
        />
      )}
    </div>
  );
}