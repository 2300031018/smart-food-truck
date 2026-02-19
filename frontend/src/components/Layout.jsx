import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

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
      { to: '/admin', label: 'Admin Dashboard' }
    );
  } else if (role === 'manager') {
    // Manager — Operations & Supervision
    navLinks.push(
      { to: '/manager', label: 'Manager Dashboard' },
      { to: '/manager/staff', label: 'My Staff' },
      { to: '/trucks', label: 'My Trucks' },
      { to: '/orders', label: 'Orders' }
    );
  } else if (role === 'staff') {
    // Staff — Execution
    navLinks.push(
      { to: '/orders', label: 'My Orders' },
      { to: '/staff/stock', label: 'My Stock' }
    );
  } else if (role === 'customer') {
    // Customer — Interaction
    navLinks.push(
      { to: '/trucks', label: 'Find Trucks' },
      { to: '/orders', label: 'My Orders' }
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: '#222', color: '#fff', padding: '10px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <strong>Smart Food Truck</strong>
        {navLinks.map(link => (
          <Link key={link.to} style={{ color: '#fff' }} to={link.to}>{link.label}</Link>
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
      <footer style={{ textAlign: 'center', padding: 20, fontSize: 12, color: '#666' }}>
        &copy; {new Date().getFullYear()} Smart Food Truck
      </footer>
    </div>
  );
}