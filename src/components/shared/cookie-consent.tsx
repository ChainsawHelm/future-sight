'use client';

import { useState, useEffect } from 'react';

const COOKIE_KEY = 'fs-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in">
      <div className="mx-auto max-w-2xl m-4 border border-border bg-card p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-foreground/80">
            We use essential cookies for authentication and preferences. No tracking or analytics cookies are used.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="h-8 px-3 border border-border bg-surface-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="h-8 px-4 bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
