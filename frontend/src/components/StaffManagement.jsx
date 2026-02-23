import React, { useEffect, useState } from 'react';
import { api, managerApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function StaffManagement({ truckId, onClose }) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [existingStaffId, setExistingStaffId] = useState('');
  const [existingStaff, setExistingStaff] = useState([]); // staff pool to assign (already created staff with no truck)

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.getTruckStaff(token, truckId);
        if (res.success && mounted) setStaff(res.data.staff || []);
        // Fetch existing staff pool for assignment
        let pool = [];
        if (user?.role === 'manager') {
          const reclaim = await managerApi.reclaimUnassigned(token);
          pool = reclaim?.data || [];
        } else {
          const allStaff = await api.listStaff(token);
          const list = allStaff?.data || [];
          pool = list.filter(s => !s.assignedTruck);
        }
        if (mounted) setExistingStaff(pool);
      } catch (e) { if (mounted) setError(e.message); } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [token, truckId]);

  async function handleAssignExisting(e) {
    e.preventDefault();
    if (!existingStaffId) return;
    setAssigning(true);
    try {
      const res = await api.assignStaff(token, truckId, existingStaffId);
      if (res.success) {
        // Refresh
        const r = await api.getTruckStaff(token, truckId);
        if (r.success) setStaff(r.data.staff || []);
        // Refresh available staff pool
        let pool = [];
        if (user?.role === 'manager') {
          const reclaim = await managerApi.reclaimUnassigned(token);
          pool = reclaim?.data || [];
        } else {
          const allStaff = await api.listStaff(token);
          const list = allStaff?.data || [];
          pool = list.filter(s => !s.assignedTruck);
        }
        setExistingStaff(pool);
        setExistingStaffId('');
      }
    } catch (e) { setError(e.message); } finally { setAssigning(false); }
  }

  async function handleUnassign(id) {
    if (!window.confirm('Remove staff from this truck?')) return;
    try {
      const res = await api.unassignStaff(token, truckId, id);
      if (res.success) {
        setStaff(s => s.filter(st => st.id !== id && st._id !== id));
      }
    } catch (e) { setError(e.message); }
  }

  if (!token) return null;
  if (loading) return <div style={modalStyle}>Loading staff...</div>;
  return (
    <div style={modalStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Truck Staff</h3>
        <button onClick={onClose}>Close</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
        {staff.map(s => (
          <li key={s.id || s._id} style={{ border: '1px solid #eee', padding: 6, borderRadius: 4, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{s.name || s.email}</span>
            {['admin', 'manager'].includes(user.role) && <button onClick={() => handleUnassign(s.id || s._id)} style={{ fontSize: 12 }}>Remove</button>}
          </li>
        ))}
        {staff.length === 0 && <li style={{ opacity: .6 }}>No staff assigned.</li>}
      </ul>
      <form onSubmit={handleAssignExisting} style={{ display: 'flex', gap: 8 }}>
        <select value={existingStaffId} onChange={e => setExistingStaffId(e.target.value)}>
          <option value=''>Select existing staff</option>
          {existingStaff.map(es => <option key={es.id} value={es.id}>{es.name || es.email}</option>)}
        </select>
        <button disabled={assigning || !existingStaffId}>{assigning ? 'Assigning...' : 'Assign Staff'}</button>
      </form>
      <p style={{ fontSize: 11, marginTop: 10, color: '#666' }}>Creating new staff currently via manager dashboard; this modal focuses on assignment/removal.</p>
    </div>
  );
}

const modalStyle = { position: 'fixed', top: 40, right: 40, width: 360, background: '#fff', boxShadow: '0 4px 18px rgba(0,0,0,0.15)', padding: 16, borderRadius: 8, zIndex: 1000 };
