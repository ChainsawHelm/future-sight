'use client';

import { useEffect } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {};
  }, []);

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden font-mono"
      style={{
        background: 'hsl(140 20% 3%)',
      }}
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(120 100% 60% / 0.03) 2px, hsl(120 100% 60% / 0.03) 4px)',
        }}
      />

      {/* Horizontal rule lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(hsl(120 30% 8% / 0.5) 1px, transparent 1px)',
          backgroundSize: '100% 24px',
          opacity: 0.6,
        }}
      />

      {/* CRT screen glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 50%, hsl(120 100% 40% / 0.04), transparent 70%)',
        }}
      />

      {/* Corner decoration — top left */}
      <div className="absolute top-4 left-4 text-primary/15 font-mono text-[10px] leading-tight pointer-events-none select-none">
        <div>+-------------------------------+</div>
        <div>| FUTURE_SIGHT TERMINAL v1.3.0  |</div>
        <div>| STATUS: AWAITING AUTH         |</div>
        <div>+-------------------------------+</div>
      </div>

      {/* Corner decoration — bottom right */}
      <div className="absolute bottom-4 right-4 text-primary/10 font-mono text-[9px] text-right leading-tight pointer-events-none select-none">
        <div>SYS.READY</div>
        <div>MEM: OK</div>
        <div>NET: CONNECTED</div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4 py-10">
        {children}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 w-full text-center pointer-events-none">
        <p className="text-[8px] tracking-[0.2em] uppercase font-mono text-primary/20">
          FUTURE_SIGHT // TERMINAL // SECURE CONNECTION
        </p>
      </div>
    </div>
  );
}
