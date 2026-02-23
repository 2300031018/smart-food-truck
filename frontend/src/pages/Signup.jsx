import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';
import AnimatedTruckScene from '../components/AnimatedTruckScene';

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if(error) setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.signup(form);
      if (res.success) {
        login(res.data.token, res.data.user);
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
            // Default to trucks or customer view if role mapping fails
            navigate(map[res.data.user.role] || '/trucks');
        }
      } else {
        setError('Signup failed. Please try again.');
        // Shake animation
        const formEl = document.querySelector('form');
        gsap.fromTo(formEl, { x: -10 }, { x: 10, duration: 0.1, repeat: 5, yoyo: true });
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      const formEl = document.querySelector('form');
      gsap.fromTo(formEl, { x: -10 }, { x: 10, duration: 0.1, repeat: 5, yoyo: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-split-container" style={{ display: 'flex', height: '100vh', width: '100%' }}>
      {/* Left Side - Signup Form */}
      <div 
        className="login-form-side"
        style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}
      >
        <div
          className="glass-panel"
          style={{
            width: '100%',
            maxWidth: 400,
            padding: 40,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <h2 className="text-gradient" style={{ 
                fontSize: '2rem', 
                marginBottom: 8,
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 800 
            }}>
                Join the Movement
            </h2>
            <p style={{ color: 'var(--text-secondary, #64748b)' }}>Start your food truck journey today</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Name Field */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)' }}>Full Name</label>
              <input
                name="name"
                placeholder="John Doe"
                type="text"
                value={form.name}
                onChange={onChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  color: 'var(--text-primary, #1e293b)', 
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary, #ff6b6b)';
                  e.target.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.1)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)';
                }}
              />
            </div>

            {/* Email Field */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)' }}>Email</label>
              <input
                name="email"
                placeholder="name@example.com"
                type="email"
                value={form.email}
                onChange={onChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  color: 'var(--text-primary, #1e293b)', 
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary, #ff6b6b)';
                  e.target.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.1)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(0,0,0,0.1)';
                  e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.05)';
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)' }}>Password</label>
              <input
                name="password"
                placeholder="Create a password"
                type="password"
                value={form.password}
                onChange={onChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  color: 'var(--text-primary, #1e293b)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--primary, #ff6b6b)';
                  e.target.style.boxShadow = '0 0 0 4px rgba(255, 107, 107, 0.1)';
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
                border: '1px solid var(--danger, #ef4444)',
                borderRadius: 8,
                color: 'var(--danger, #ef4444)',
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
                background: 'var(--primary, #ff6b6b)',
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
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--primary, #ff6b6b)', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
          </div>
        </div>
      </div>

      {/* Right Side - Image/Brand Area */}
      <div 
        className="login-image-side" 
        style={{ 
            flex: 1.2,
            position: 'relative',
            overflow: 'hidden',
            display: 'block' // Ensure visibility if CSS module isn't loaded
        }}
      >
        <AnimatedTruckScene />
        
        {/* Animated Headline Overlay - Feature Flex */}
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: '80%',
          zIndex: 50,
          textAlign: 'left'
        }}>
           <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: 800, 
            lineHeight: 1.1, 
            marginBottom: '20px',
            textShadow: '0 4px 10px rgba(0,0,0,0.6)',
            letterSpacing: '-1px',
            color: '#fff'
           }}>
             100+ Trucks <br/>
             <span style={{ color: '#fff' }}>One Map.</span>
           </h1>
           
           <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>📍</span>
                <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Real-time GPS Tracking</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>🔥</span>
                <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Exclusive Deals & Drops</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>👥</span>
                <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Join 50k+ Foodies</span>
              </div>
           </div>

           {/* Rotating Testimonials */}
           <TestimonialRotator />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
            .login-image-side {
                display: none !important;
            }
        }
      `}</style>
    </div>
  );
}

function TestimonialRotator() {
  const testimonials = [
    { text: "Found the best Dosa truck near my office! Live tracking is a lifesaver.", name: "Arjun Reddy", img: "https://randomuser.me/api/portraits/men/32.jpg" },
    { text: "Finally an app that tracks authentic Idli spots. Steaming hot breakfast on time!", name: "Priya Nair", img: "https://randomuser.me/api/portraits/women/44.jpg" },
    { text: "Love the exclusive deals. Saved so much on my evening Bajji snacks.", name: "Karthik R.", img: "https://randomuser.me/api/portraits/men/46.jpg" },
    { text: "The community features are great. Found amazing hidden Biryani spots in Chennai.", name: "Divya Menon", img: "https://randomuser.me/api/portraits/women/65.jpg" },
    { text: "Super useful for finding late night Parotta stalls. Highly recommended!", name: "Vikram Singh", img: "https://randomuser.me/api/portraits/men/86.jpg" }
  ];

  const [index, setIndex] = useState(0);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      gsap.to(containerRef.current, { opacity: 0, y: -10, duration: 0.5, onComplete: () => {
        setIndex(prev => (prev + 1) % testimonials.length);
        // Fade in
        gsap.fromTo(containerRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 });
      }});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const t = testimonials[index];

  return (
    <div 
      ref={containerRef}
      style={{ 
        background: 'rgba(255,255,255,0.15)', 
        backdropFilter: 'blur(10px)', 
        padding: '20px', 
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.2)',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', color: '#FFD700', fontSize: '1.2rem' }}>★★★★★</div>
      <p style={{ color: '#fff', fontSize: '1.05rem', fontStyle: 'italic', marginBottom: '16px', lineHeight: 1.5, minHeight: '60px' }}>
        "{t.text}"
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.5)' }}>
          <img src={t.img} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div>
           <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{t.name}</span>
           <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>Verified Foodie</span>
        </div>
      </div>
    </div>
  );
}
