'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
        const data = await res.json();
        if (data.link_token) setLinkToken(data.link_token);
        else setError('Could not initialize bank connection');
      } catch { setError('Could not connect to Plaid'); }
    };
    createLinkToken();
  }, []);

  const handleClick = () => {
    if (!linkToken || !scriptLoaded || !(window as any).Plaid) return;
    setLoading(true);
    const handler = (window as any).Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string, metadata: any) => {
        try {
          const res = await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_token: publicToken, metadata }),
          });
          const data = await res.json();
          if (data.success) {
            await fetch('/api/plaid/sync', { method: 'POST' });
            onSuccess?.();
          }
        } catch {}
        setLoading(false);
      },
      onExit: () => { setLoading(false); },
    });
    handler.open();
  };

  if (error) return <div className="text-sm text-red-500">{error}</div>;

  return (
    <Button
      onClick={handleClick}
      disabled={!linkToken || !scriptLoaded || loading}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      {loading ? 'Connecting...' : !linkToken ? 'Loading...' : 'Connect Bank Account'}
    </Button>
  );
}
