import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatDrawer from './ChatDrawer';
import { chatApi } from '../api/chat';

export default function Layout({ children }) {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [supportOpen, setSupportOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Build role-specific navigation
  const role = token ? user?.role : null;
  const navLinks = [];
  if (!token) {
    navLinks.push({ to: '/trucks', label: 'Trucks' });
  } else if (role === 'admin') {
    // Admin — System Control Layer
    navLinks.push(
      { to: '/admin', label: 'Admin Dashboard' },
      { to: '/admin/hierarchy', label: 'Hierarchy' },
      { to: '/admin/staff', label: 'Staff' },
      { to: '/trucks', label: 'Trucks' }
    );
  } else if (role === 'manager') {
    // Manager — Operations & Supervision
    navLinks.push(
      { to: '/manager', label: 'Manager Dashboard' },
      { to: '/manager/staff', label: 'My Staff' },
      { to: '/trucks', label: 'My Trucks' },
      { to: '/orders', label: 'Orders' },
      { to: '/reservations', label: 'Reservations' }
    );
  } else if (role === 'staff') {
    // Staff — Execution
    navLinks.push(
      { to: '/staff', label: 'Staff Dashboard' },
      { to: '/staff/stock', label: 'My Stock' },
      { to: '/orders', label: 'Orders' }
    );
  } else if (role === 'customer') {
    // Customer — Interaction
    navLinks.push(
      { to: '/customer', label: 'Dashboard' },
      { to: '/trucks', label: 'Find Trucks' },
      { to: '/orders/new', label: 'New Order' },
      { to: '/orders', label: 'My Orders' },
      { to: '/reservations/new', label: 'Book Truck' },
      { to: '/reservations', label: 'Reservations' }
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: '#222', color: '#fff', padding: '10px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <strong>Smart Food Truck</strong>
        {navLinks.map(link => (
          <Link key={link.to} style={{ color:'#fff' }} to={link.to}>{link.label}</Link>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {token ? (
            <>
              <span style={{ fontSize: 14 }}>{user?.email} ({user?.role})</span>
              <button onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</button>
            </>
          ) : (
            <>
              <Link style={{ color: '#fff' }} to="/login">Login</Link>
              <Link style={{ color: '#fff' }} to="/signup">Sign Up</Link>
            </>
          )}
        </div>
      </nav>
      <main style={{ flex: 1 }}>{children}</main>
      {token && (
        <>
          <button onClick={() => setSupportOpen(true)}
            style={{ position:'fixed', right:16, bottom:20, background:'#2563eb', color:'#fff', border:'none', borderRadius:22, padding:'10px 14px', cursor:'pointer', boxShadow:'0 6px 18px rgba(37,99,235,0.35)', zIndex:9998 }}>
            Support
          </button>
          <ChatDrawer
            open={supportOpen}
            onClose={()=> setSupportOpen(false)}
            title="Support Chat"
            roomResolver={(tok)=> chatApi.getSupportRoom(tok)}
          />
        </>
      )}
      <footer style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#666' }}>
        &copy; {new Date().getFullYear()} Smart Food Truck
      </footer>
    </div>
  );
}