import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
    const navigate = useNavigate();
    const heroRef = useRef(null);
    const titleRef = useRef(null);
    const subtitleRef = useRef(null);
    const ctaRef = useRef(null);
    const featuresRef = useRef(null);
    const { token, user } = useAuth();

    useEffect(() => {
        const tl = gsap.timeline();

        tl.fromTo(titleRef.current,
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
        )
            .fromTo(subtitleRef.current,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
                "-=0.6"
            )
            .fromTo(ctaRef.current,
                { opacity: 0, scale: 0.9 },
                { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" },
                "-=0.4"
            );

        gsap.fromTo(featuresRef.current.children,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.2,
                scrollTrigger: {
                    trigger: featuresRef.current,
                    start: "top 80%",
                }
            }
        );
    }, []);

    return (
        <div className="home-page" style={{ background: 'var(--bg-primary)' }}>
            {/* Hero Section */}
            <section
                ref={heroRef}
                style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    // Increased overlay opacity to 40% (0.4) to ensure text readability on any image
                    background: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url('/images/hero-bg.png') center/cover no-repeat`,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div className="container" style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '10px 24px',
                        background: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(5px)',
                        color: '#fff',
                        borderRadius: '50px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        marginBottom: '1.5rem',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        border: '1px solid rgba(255,255,255,0.3)'
                    }}>
                        Street Food Reimagined
                    </div>
                    <h1
                        ref={titleRef}
                        style={{
                            fontSize: 'clamp(3.5rem, 10vw, 7rem)',
                            marginBottom: '1.5rem',
                            color: '#fff',
                            fontWeight: 900,
                            letterSpacing: '-2px',
                            lineHeight: 1,
                            textShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                    >
                        THE <span className="text-gradient" style={{ 
                            background: 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            textShadow: 'none'
                        }}>HOURLY</span><br />
                        BITE
                    </h1>

                    <p
                        ref={subtitleRef}
                        style={{
                            fontSize: '1.4rem',
                            color: '#fff', // Changed to white for better contrast primarily
                            marginBottom: '3.5rem',
                            maxWidth: '700px',
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            lineHeight: '1.6',
                            fontWeight: 500,
                            textShadow: '0 2px 4px rgba(0,0,0,0.8)', // Strong shadow for readability
                            opacity: 0.95
                        }}
                    >
                        Connecting foodie hearts with the city's finest gourmet trucks in real-time. Live tracking, zero waiting.
                    </p>

                    <div ref={ctaRef} style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                        <button
                            className="btn-primary"
                            onClick={() => {
                                if (token) {
                                    const role = user?.role;
                                    if (role === 'admin') navigate('/admin');
                                    else if (role === 'manager') navigate('/manager');
                                    else if (role === 'staff') navigate('/orders');
                                    else navigate('/trucks');
                                } else {
                                    navigate('/trucks');
                                }
                            }}
                            style={{
                                padding: '1.2rem 3.5rem',
                                fontSize: '1.2rem'
                            }}
                        >
                            {token ? 'Back to Dashboard' : 'Explore Nearby Trucks'}
                        </button>
                        {!token && (
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    padding: '1.2rem 3.5rem',
                                    fontSize: '1.2rem',
                                    fontWeight: 700,
                                    borderRadius: '50px',
                                    background: '#fff',
                                    border: '1px solid #e2e8f0',
                                    color: '#0f172a',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = '#f8fafc';
                                    e.target.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = '#fff';
                                    e.target.style.transform = 'translateY(0)';
                                }}
                            >
                                Join the Community
                            </button>
                        )}
                    </div>
                </div>

                {/* Decorative elements - Removed white shade as per request */}

            </section>

            {/* Features Section */}
            <section style={{ padding: '120px 0', background: 'var(--bg-primary)' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                        <h2 style={{ fontSize: '3rem', color: '#0f172a', marginBottom: '1rem' }}>Why Gourmet Lovers Love Us</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>We've reimagined the street food experience from the ground up.</p>
                    </div>
                    <div
                        ref={featuresRef}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                            gap: '3rem'
                        }}
                    >
                        <FeatureCard
                            icon="📍"
                            title="Live GPS Tracking"
                            desc="Know exactly where your favorite trucks are. Real-time updates every few seconds."
                            color="#ff6b6b"
                        />
                        <FeatureCard
                            icon="⚡"
                            title="Express Pickup"
                            desc="Order through the app and skip the queue. Your food is ready when you arrive."
                            color="#3b82f6"
                        />
                        <FeatureCard
                            icon="💎"
                            title="Curated Selection"
                            desc="Only the highest-rated, gourmet-certified trucks make it to our platform."
                            color="#10b981"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function FeatureCard({ icon, title, desc, color }) {
    return (
        <div
            className="glass-panel"
            style={{
                padding: '3rem 2.5rem',
                textAlign: 'left',
                border: '1px solid rgba(0,0,0,0.03)',
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
                gsap.to(e.currentTarget, { y: -15, scale: 1.02 });
            }}
            onMouseLeave={(e) => {
                gsap.to(e.currentTarget, { y: 0, scale: 1 });
            }}
        >
            <div style={{
                width: '60px',
                height: '60px',
                background: `${color}15`,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                marginBottom: '2rem'
            }}>
                {icon}
            </div>
            <h3 style={{ marginBottom: '1rem', color: '#0f172a', fontSize: '1.5rem' }}>{title}</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1.05rem' }}>{desc}</p>
        </div>
    );
}
