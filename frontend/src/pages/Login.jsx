import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';
import AnimatedTruckScene from '../components/AnimatedTruckScene';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.success) {
        login(res.data.token, res.data.user);
        const role = res.data.user.role;
        const map = {
          admin: '/admin',
          manager: '/manager',
          staff: '/orders',
          customer: '/trucks'
        };
        const redirect = localStorage.getItem('sft_redirect');
        if (redirect) {
          localStorage.removeItem('sft_redirect');
          navigate(redirect);
        } else {
          navigate(map[role] || '/');
        }
      } else {
        setError('Login failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-split-container">
      {/* Left Side - Login Form */}
      <div className="login-form-side">
        <div
          className="glass-panel"
          style={{
            width: '100%',
            maxWidth: 400,
            padding: 40,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: 8 }}>Welcome Back</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Sign in to continue your food journey</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email</label>
              <input
                placeholder="name@example.com"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  color: 'var(--text-primary)', 
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary)';
                  e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 107, 0.2)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)';
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
              <input
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary)';
                  e.target.style.boxShadow = '0 0 0 2px rgba(255, 107, 107, 0.2)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)';
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger)',
                borderRadius: 8,
                color: 'var(--danger)',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <button
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: 8,
                marginTop: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'transform 0.2s',
                border: 'none',
                boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
              }}
              onMouseEnter={e => { if (!loading) { e.target.style.transform = 'translateY(-2px)'; } }}
              onMouseLeave={e => { if (!loading) { e.target.style.transform = 'translateY(0)'; } }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Don't have an account? <Link to="/signup" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Create one</Link>
          </div>
        </div>
      </div>

      {/* Right Side - Image/Brand Area */}
      <div className="login-image-side" style={{ overflow: 'hidden', position: 'relative' }}>
        <AnimatedTruckScene />
        
        {/* Animated Headline Overlay - floats over the scene */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: '80%',
          zIndex: 50,
          color: '#fff',
          textAlign: 'left'
        }}>
           <h1 style={{ 
            fontSize: '3.5rem', 
            fontWeight: 800, 
            lineHeight: 1.1, 
            marginBottom: '20px',
            textShadow: '0 4px 10px rgba(0,0,0,0.6)',
            letterSpacing: '-1px',
            color: '#fff'
           }}>
             Taste the City,<br/>
             <span style={{ color: '#fff' }}>Now!</span>
           </h1>
           <p style={{ 
             fontSize: '1.2rem', 
             fontWeight: 400,
             opacity: 0.9,
             maxWidth: '430px',
             lineHeight: 1.6,
             textShadow: '0 2px 5px rgba(0,0,0,0.5)',
             borderLeft: '4px solid #fff',
             paddingLeft: '15px',
             color: '#fff'
           }}>
             "Every meal tells a story. Find yours today with our live map tracking over 500+ local champions."
           </p>
        </div>
      </div>
    </div>
  );
}
