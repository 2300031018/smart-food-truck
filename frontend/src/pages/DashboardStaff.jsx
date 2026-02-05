import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function DashboardStaff(){
  const { token, user } = useAuth();
  const [truckName, setTruckName] = useState(null);

  useEffect(() => {
    if (user?.assignedTruck) {
      api.getTruck(user.assignedTruck)
        .then(res => {
          if (res.success && res.data) setTruckName(res.data.name);
        })
        .catch(() => {});
    }
  }, [user, token]);

  return (
    <div className="dashboard-container">
      <div className="card">
        <h2 style={{ marginBottom:'0.5rem' }}>Staff Dashboard</h2>
        <p style={{ fontSize:16, color:'#555', marginBottom:20 }}>
          Welcome, <strong>{user?.name || user?.email}</strong>
        </p>

        {user?.assignedTruck ? (
          <div>
            <div style={{ marginBottom: 20 }}>
              <span className="badge badge-green" style={{ fontSize:14, padding:'6px 12px' }}>
                Assignment: {truckName || 'Loading...'}
              </span>
            </div>
            
            <div style={{ display:'flex', gap:15, marginTop:20 }}>
              <Link to="/staff/stock" className="btn btn-primary" style={{ padding:'12px 24px', fontSize:16 }}>
                📋 Manage Stock
              </Link>
              <Link to="/orders" className="btn btn-primary" style={{ padding:'12px 24px', fontSize:16 }}>
                🕐 Truck Orders
              </Link>
            </div>
            <p style={{ marginTop:25, fontSize:14, color:'#666', borderTop:'1px solid #eee', paddingTop:15 }}>
              Use <strong style={{color:'#2563eb'}}>Manage Stock</strong> to mark items as Sold Out or Back In Stock.<br/>
              Use <strong style={{color:'#2563eb'}}>Truck Orders</strong> to view incoming orders and update status (Preparing → Ready).
            </p>
          </div>
        ) : (
          <div className="card" style={{ background:'#fefce8', border:'1px solid #fde047', color:'#854d0e', marginBottom:0 }}>
            You are not currently assigned to any truck. Please contact your manager.
          </div>
        )}
      </div>
    </div>
  );
}