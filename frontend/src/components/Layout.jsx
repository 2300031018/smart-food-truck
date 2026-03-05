import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';

export default function Layout({ children }) {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    
    // Close mobile menu when route changes
    setMobileMenuOpen(false);

    // Theme Switching Logic
    const isConsumerPath = ['/', '/login', '/signup', '/trucks', '/orders'].some(path =>
      location.pathname === path || location.pathname.startsWith(path + '/')
    );

    // Explicitly exclude admin/manager/staff/analytics routes just in case of overlap
    const isAdminPath = ['/admin', '/manager', '/staff', '/analytics'].some(path =>
      location.pathname.startsWith(path)
    );

    if (isConsumerPath && !isAdminPath) {
      document.body.classList.add('premium-theme');
    } else {
      document.body.classList.remove('premium-theme');
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Cleanup theme on unmount? Maybe not needed if Layout is persistent, but good practice
      document.body.classList.remove('premium-theme');
    };
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Build role-specific navigation
  const role = token ? user?.role : null;
  // Remove Home link for logged-in users to avoid redundancy with Dashboard
  const navLinks = token ? [] : [{ to: '/', label: 'Home' }];

  if (!token) {
    navLinks.push({ to: '/trucks', label: 'Trucks' });
  } else if (role === 'admin') {
    navLinks.push(
      { to: '/admin', label: 'Admin' },
      { to: '/analytics', label: 'Analytics' }
    );
  } else if (role === 'manager') {
    navLinks.push(
      { to: '/manager', label: 'Dashboard' },
      { to: '/trucks', label: 'My Trucks' },
      { to: '/orders', label: 'Orders' }
    );
  } else if (role === 'staff') {
    navLinks.push(
      { to: '/orders', label: 'Orders' },
      { to: '/staff/stock', label: 'Stock' }
    );
  } else if (role === 'customer') {
    navLinks.push(
      { to: '/trucks', label: 'Find Trucks' },
      { to: '/orders', label: 'My Orders' }
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: 'var(--nav-height)',
          zIndex: 1000,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          background: scrolled || location.pathname !== '/' ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
          backdropFilter: scrolled || location.pathname !== '/' ? 'blur(20px)' : 'none',
          boxShadow: scrolled || location.pathname !== '/' ? '0 4px 30px rgba(0, 0, 0, 0.03)' : 'none',
          borderBottom: scrolled || location.pathname !== '/' ? '1px solid rgba(0,0,0,0.05)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(0.5rem, 2vw, 2rem) clamp(1rem, 4vw, 4rem)'
        }}
      >
        <Link to="/" style={{ 
          fontSize: 'clamp(1rem, 3vw, 1.5rem)', 
          fontWeight: 800, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          fontFamily: "'Montserrat', sans-serif", 
          letterSpacing: '-0.5px',
          textDecoration: 'none',
          position: 'relative',
          zIndex: 1002
        }}>
          <span style={{ color: 'var(--primary, #ef4444)' }}>THE HOURLY</span>
          <span style={{ color: scrolled || location.pathname !== '/' ? '#0f172a' : '#fff' }}>BITE</span>
        </Link>

        {/* Mobile Hamburger Button */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            cursor: 'pointer',
            color: scrolled || location.pathname !== '/' ? '#0f172a' : '#fff'
          }}
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Navigation Menu */}
        <div className={`nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: location.pathname === link.to ? 'var(--primary)' : (scrolled || location.pathname !== '/' ? 'var(--text-secondary)' : 'rgba(255,255,255,0.8)'),
                fontWeight: 600,
                fontSize: '0.95rem',
                position: 'relative',
                transition: 'color 0.3s ease'
              }}
              className="nav-link"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'clamp(0.75rem, 3vw, 1.5rem)', alignItems: 'center', justifyContent: 'flex-end' }}>
          {token ? (
            <div style={{ padding: '0.4rem 0.4rem 0.4rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '50px', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.9rem)', fontWeight: 600, color: '#334155' }}>👋 {user?.name || 'User'}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" style={{ color: scrolled || location.pathname !== '/' ? 'var(--text-primary)' : '#fff', fontWeight: 600, fontSize: 'clamp(0.8rem, 2vw, 0.95rem)' }}>Login</Link>
              <Link
                to="/signup"
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  padding: '0.8rem 2rem',
                  borderRadius: '50px',
                  fontWeight: 700,
                  boxShadow: '0 8px 20px rgba(255, 107, 107, 0.25)',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 'clamp(0.8rem, 2vw, 1rem)'
                }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      <main style={{ flex: 1, paddingTop: location.pathname === '/' ? 0 : 'calc(var(--nav-height) + 2rem)', minHeight: 'calc(100vh - var(--nav-height))' }}>
        {children}
      </main>

      {location.pathname !== '/' && (
        <footer style={{
          padding: '4rem 2rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          background: '#fff',
          textAlign: 'center'
        }}>
          <div className="container" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.5rem', color: '#0f172a', marginBottom: '1rem' }}>The Hourly Bite</h2>
            <p style={{ fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.8 }}>
              The future of street food. Real-time gourmet experiences delivered with passion.
            </p>
            <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>&copy; {new Date().getFullYear()} The Hourly Bite. Crafted for gourmet lovers.</p>
          </div>
        </footer>
      )}
    </div>
  );
}