import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function DashboardCustomer(){
  const { user } = useAuth();
  return (
    <div style={{ padding:20, fontFamily:'system-ui' }}>
      <h2>Customer Dashboard</h2>
      <p>Welcome {user?.email}</p>
      <ul>
        <li><Link to='/trucks'>Browse Trucks</Link></li>
        <li><Link to='/orders/new'>Create Order</Link></li>
        <li><Link to='/reservations/new'>Create Reservation</Link></li>
        <li><Link to='/orders'>My Orders</Link></li>
        <li><Link to='/reservations'>My Reservations</Link></li>
      </ul>
    </div>
  );
}