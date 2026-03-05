'use client';

import { useEffect } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Force dark mode on auth pages — FENIX is dark-first
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => { /* keep dark after navigating away — app-shell handles it */ };
  }, []);

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 130% 55% at 50% -5%, hsl(258 50% 18% / 0.55), transparent 65%),
          radial-gradient(ellipse 60% 40% at 95% 5%, hsl(215 80% 20% / 0.25), transparent 55%),
          hsl(235 35% 5%)
        `,
      }}
    >
      {/* Crosshatch grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsl(237 26% 10% / 0.8) 1px, transparent 1px),
            linear-gradient(90deg, hsl(237 26% 10% / 0.8) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: 0.7,
        }}
      />

      {/* Large FENIX watermark — bottom right */}
      <div className="absolute bottom-[-40px] right-[-40px] opacity-[0.04] pointer-events-none select-none">
        <svg width="320" height="320" viewBox="0 0 28 28" fill="none">
          <defs>
            <linearGradient id="wm-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E8C87A"/>
              <stop offset="100%" stopColor="#9A6828"/>
            </linearGradient>
          </defs>
          <path d="M14 2L26 14L14 26L2 14Z" fill="url(#wm-gold)"/>
        </svg>
      </div>

      {/* Top-left orbit decoration */}
      <div className="absolute top-8 left-8 opacity-[0.08] pointer-events-none">
        <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
          <circle cx="90" cy="90" r="80" stroke="hsl(42 55% 55%)" strokeWidth="0.5"/>
          <circle cx="90" cy="90" r="55" stroke="hsl(42 55% 55%)" strokeWidth="0.5" strokeDasharray="4 8"/>
          <circle cx="90" cy="90" r="30" stroke="hsl(42 55% 55%)" strokeWidth="0.5"/>
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4 py-12">
        {children}
      </div>

      {/* Footer */}
      <div className="absolute bottom-5 w-full text-center pointer-events-none">
        <p className="text-[9px] tracking-[0.2em] uppercase font-mono text-muted-foreground/30">
          Future Sight · FENIX · Built for clarity
        </p>
      </div>
    </div>
  );
}
