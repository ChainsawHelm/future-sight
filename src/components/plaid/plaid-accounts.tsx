'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

export function PlaidAccounts({ onSync }: { onSync?: () => void }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/plaid/accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {}
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult('Synced: ' + data.added + ' new, ' + data.modified + ' updated, ' + data.removed + ' removed');
        fetchAccounts();
        onSync?.();
      } else setSyncResult(data.error || 'Sync failed');
    } catch { setSyncResult('Sync failed'); }
    setSyncing(false);
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Unlink this bank account?')) return;
    await fetch('/api/plaid/accounts?id=' + id, { method: 'DELETE' });
    fetchAccounts();
  };

  if (accounts.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Linked Bank Accounts</h2>
        <Button size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </div>
      {syncResult && <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{syncResult}</p>}
      <div className="space-y-2">
        {accounts.map((acct: any) => (
          <div key={acct.id} className="flex items-center justify-between bg-background rounded-lg px-4 py-3 border">
            <div>
              <p className="text-sm font-medium">{acct.institutionName || 'Unknown Bank'}</p>
              <p className="text-[11px] text-muted-foreground">
                {acct.lastSynced ? 'Last synced ' + formatDate(acct.lastSynced) : 'Never synced'}
              </p>
            </div>
            <button onClick={() => handleUnlink(acct.id)} className="text-xs text-red-500 hover:underline">Unlink</button>
          </div>
        ))}
      </div>
    </div>
  );
}
