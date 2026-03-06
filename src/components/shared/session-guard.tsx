'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — lock screen before full logout
const CHECK_INTERVAL_MS = 30 * 1000;     // Check every 30 seconds

/**
 * SessionGuard — monitors user activity and:
 * 1. Locks the screen after 15 min idle (blur overlay, click to re-auth)
 * 2. Fully signs out after 30 min idle
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (locked) return; // Don't unlock via activity — must click unlock
  }, [locked]);

  // Track user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity));
    };
  }, [resetActivity]);

  // Check idle status periodically
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;

      if (idle >= IDLE_TIMEOUT_MS) {
        // Full sign out
        signOut({ callbackUrl: '/login?reason=idle' });
      } else if (idle >= LOCK_TIMEOUT_MS && !locked) {
        setLocked(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [locked]);

  // Also lock on visibility change (tab switch, minimize)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Start counting from now if tab is hidden
      } else {
        // If returning after long absence, check idle
        const idle = Date.now() - lastActivityRef.current;
        if (idle >= LOCK_TIMEOUT_MS) setLocked(true);
        if (idle >= IDLE_TIMEOUT_MS) signOut({ callbackUrl: '/login?reason=idle' });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleUnlock = () => {
    lastActivityRef.current = Date.now();
    setLocked(false);
  };

  return (
    <>
      {children}
      {locked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-lg bg-black/80">
          <div className="text-center space-y-4 max-w-sm mx-4">
            <div className="text-4xl mb-2">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto text-yellow-400">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Session Locked</h2>
            <p className="text-sm text-zinc-400">
              Your session was locked due to inactivity.
              <br />
              Auto sign-out in {Math.ceil((IDLE_TIMEOUT_MS - LOCK_TIMEOUT_MS) / 60000)} minutes.
            </p>
            <button
              onClick={handleUnlock}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors"
            >
              Resume Session
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="block mx-auto text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Sign out instead
            </button>
          </div>
        </div>
      )}
    </>
  );
}
