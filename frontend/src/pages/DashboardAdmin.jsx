import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function DashboardAdmin(){
  const { user, token } = useAuth();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    let mounted = true;
    setLoading(true);
    api.getTrucks()
      .then(res => { if (mounted && res.success) setTrucks(res.data || []); })
      .catch(e => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, user]);

  if (!token) return <p style={{ padding:20 }}>Unauthorized</p>;
  if (user?.role !== 'admin') return <p style={{ padding:20 }}>Forbidden</p>;

  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Admin Console</h2>
      <p>Welcome {user?.email}</p>
      <nav style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:10 }}>
        <Link to="/admin" style={navLink}>Menu</Link>
        <Link to="/admin/trucks" style={navLink}>Trucks</Link>
        <Link to="/admin/managers" style={navLink}>Managers</Link>
        <Link to="/admin/staff" style={navLink}>Staff</Link>
        <Link to="/admin/orders" style={navLink}>Orders</Link>
      </nav>
      <p style={{ color:'#555', marginTop:12 }}>
        Choose a truck to manage its menu (add items and mark Available/Unavailable).
      </p>

      {loading && <p>Loading trucks…</p>}
      {error && <p style={{ color:'red' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ marginTop:12, display:'grid', gap:12 }}>
          {trucks.map(t => (
            <div key={t.id || t._id} style={{ border:'1px solid #ddd', borderRadius:6, padding:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <strong>{t.name}</strong>
                <div style={{ fontSize:12, color:'#666' }}>Status: {t.status || '—'}</div>
              </div>
              <Link to={`/trucks/${t.id || t._id}/menu-manage`} style={{ padding:'6px 10px', border:'1px solid #2563eb', borderRadius:4, color:'#2563eb', textDecoration:'none' }}>
                Manage Menu
              </Link>
            </div>
          ))}
          {trucks.length === 0 && <div style={{ color:'#777' }}>No trucks available.</div>}
        </div>
      )}
    </div>
  );
}

const navLink = {
  padding:'6px 10px',
  border:'1px solid #ddd',
  borderRadius:6,
  textDecoration:'none',
  color:'#111'
};

