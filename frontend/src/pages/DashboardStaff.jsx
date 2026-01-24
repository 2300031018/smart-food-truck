import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardStaff(){
  const { user } = useAuth();
  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Staff Dashboard</h2>
      <p>Welcome {user?.email}</p>
      <p>You can update stock and mark items sold out on your assigned truck. For adding/editing items or enabling items, please contact your Manager or Admin.</p>
    </div>
  );
}