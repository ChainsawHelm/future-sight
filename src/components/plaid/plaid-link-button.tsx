'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';

function PlaidLinkOpener({ linkToken, onSuccess }: { linkToken: string; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSuccess = useCallback(async (publicToken: string, metadata: any) => {
    setLoading(true);
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
  }, [onSuccess]);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess: handleSuccess });

  return (
    <Button onClick={() => open()} disabled={!ready || loading} className="bg-green-600 hover:bg-green-700 text-white">
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </Button>
  );
}

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (!linkToken) return <Button disabled className="bg-green-600 text-white">Loading...</Button>;

  return <PlaidLinkOpener linkToken={linkToken} onSuccess={onSuccess} />;
}
