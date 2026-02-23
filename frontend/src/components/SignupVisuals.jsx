import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const IMAGES = [
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80", // Food Truck
  "https://images.unsplash.com/photo-1565557623262-b51c2513a641?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80", // Curry/Food
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80", // Restaurant plate
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80", // Feast
];

export default function SignupVisuals() {
  const containerRef = useRef(null);
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    // Cycle images
    const interval = setInterval(() => {
      setCurrentImage(prev => (prev + 1) % IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
       {IMAGES.map((src, index) => (
        <VisualSlide 
          key={src} 
          src={src} 
          isActive={currentImage === index} 
        />
      ))}
      
      <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 100%)',
          zIndex: 10
      }} />

      <div style={{
          position: 'absolute',
          bottom: '15%',
          left: '10%',
          width: '80%',
          zIndex: 20,
          color: '#fff'
      }}>
          <h2 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem' }}>
            <span style={{ color: '#ff6b6b' }}>Unlock</span> Exclusive<br/>
            Street Flavors.
          </h2>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
               <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '12px' }}>
                   <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>⚡</div>
                   <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Skip Lines</div>
               </div>
               <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '12px' }}>
                   <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>🎁</div>
                   <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Daily Deals</div>
               </div>
               <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '12px' }}>
                   <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>📍</div>
                   <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Live Tracker</div>
               </div>
          </div>
      </div>
    </div>
  );
}

function VisualSlide({ src, isActive }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    let ctx = gsap.context(() => {
      if (isActive) {
        gsap.set(ref.current, { zIndex: 2, opacity: 1, scale: 1.1 });
        gsap.to(ref.current, { duration: 5, scale: 1, ease: 'power1.out' });
      } else {
        gsap.to(ref.current, { duration: 1, opacity: 0, zIndex: 1 });
      }
    }, ref);
    return () => ctx.revert();
  }, [isActive]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0
      }}
    />
  );
}
