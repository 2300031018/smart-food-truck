import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const IMAGES = [
  // Night Street Food / Truck Vibes
  "https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1951&q=80",
  "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80"
];

export default function AnimatedTruckScene() {
  const containerRef = useRef(null);
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    // Cycle images every 6 seconds
    const interval = setInterval(() => {
      setCurrentImage(prev => (prev + 1) % IMAGES.length);
    }, 6000); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0f172a'
      }}
    >
      {IMAGES.map((src, index) => (
        <SlideImage 
          key={src} 
          src={src} 
          isActive={currentImage === index} 
        />
      ))}
      
      {/* Cinematic Overlay - Gradient */}
      <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.1) 40%, rgba(15,23,42,0.6) 100%)',
          zIndex: 10,
          pointerEvents: 'none'
      }} />

      {/* Modern Grid/Tech Overlay - subtle "Smart" feel */}
      <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.2,
          zIndex: 11,
          pointerEvents: 'none'
      }} />
    </div>
  );
}

function SlideImage({ src, isActive }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    
    let ctx = gsap.context(() => {
      if (isActive) {
        // Enforce zIndex to be top
        gsap.set(ref.current, { zIndex: 2, opacity: 1, scale: 1.2 });
        // Slow pan/zoom (Ken Burns Effect)
        gsap.fromTo(ref.current, 
          { scale: 1.2, filter: 'brightness(0.6)' },
          { 
            duration: 7, 
            scale: 1, 
            filter: 'brightness(0.8)',
            ease: 'power1.out' 
          }
        );
      } else {
        // Fade out and send to back
        gsap.to(ref.current, { 
          duration: 1.5, 
          opacity: 0, 
          zIndex: 1,
          ease: 'power2.in'
        });
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
        height: '100%',
        width: '100%',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundImage: `url(${src})`,
        opacity: 0, // start hidden
        willChange: 'transform, opacity'
      }}
    />
  );
}
