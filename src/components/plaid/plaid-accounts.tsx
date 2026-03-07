'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils';

interface PlaidSubAccount {
  id: string;
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  mask: string | null;
  isoCurrencyCode: string | null;
}

interface PlaidInstitution {
  id: string;
  institutionName: string | null;
  isActive: boolean;
  lastSynced: string | null;
  createdAt: string;
  accounts: PlaidSubAccount[];
}

function AccountTypeBadge({ type, subtype }: { type: string; subtype: string | null }) {
  const label = subtype ?? type;
  const colorClass = type === 'credit' || type === 'loan'
    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
    : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${colorClass}`}>
      {label}
    </span>
  );
}

export function PlaidAccounts({ onSync }: { onSync?: () => void }) {
  const [institutions, setInstitutions] = useState<PlaidInstitution[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/plaid/accounts');
      const data = await res.json();
      setInstitutions(data.institutions || []);
    } catch {}
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncSuccess(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Synced: ${data.added} new, ${data.modified} updated, ${data.removed} removed`);
        setSyncSuccess(true);
        fetchAccounts();
        onSync?.();
      } else {
        setSyncResult(data.error || 'Sync failed');
        setSyncSuccess(false);
      }
    } catch {
      setSyncResult('Sync failed — could not reach server');
      setSyncSuccess(false);
    }
    setSyncing(false);
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Unlink this bank connection? This will remove all associated account data.')) return;
    await fetch('/api/plaid/accounts?id=' + id, { method: 'DELETE' });
    fetchAccounts();
  };

  if (institutions.length === 0) return null;

  return (
    <div className="border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Linked Bank Accounts</h2>
        <Button size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </div>

      {syncResult && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2.5 border ${
          syncSuccess
            ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
            : 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
        }`}>
          <span className="font-semibold shrink-0">{syncSuccess ? '✓' : '✕'}</span>
          <span>{syncResult}</span>
        </div>
      )}

      <div className="space-y-4">
        {institutions.map((inst) => (
          <div key={inst.id} className="space-y-2">
            {/* Institution header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{inst.institutionName || 'Unknown Bank'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {inst.lastSynced ? 'Last synced ' + formatDate(inst.lastSynced) : 'Never synced'}
                </p>
              </div>
              <button onClick={() => handleUnlink(inst.id)} className="text-xs text-red-500 hover:underline">
                Unlink
              </button>
            </div>

            {/* Individual accounts */}
            {inst.accounts.length > 0 ? (
              <div className="space-y-1.5 pl-2 border-l-2 border-muted">
                {inst.accounts.map((acct) => {
                  const balance = acct.currentBalance ?? acct.availableBalance;
                  const isDebt = acct.type === 'credit' || acct.type === 'loan';
                  return (
                    <div key={acct.id} className="flex items-center justify-between bg-background px-3 py-2 border">
                      <div className="flex items-center gap-2 min-w-0">
                        <AccountTypeBadge type={acct.type} subtype={acct.subtype} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {acct.name}{acct.mask ? ` ····${acct.mask}` : ''}
                          </p>
                          {acct.officialName && acct.officialName !== acct.name && (
                            <p className="text-[10px] text-muted-foreground truncate">{acct.officialName}</p>
                          )}
                        </div>
                      </div>
                      {balance !== null && (
                        <p className={`text-xs font-semibold shrink-0 ml-3 ${isDebt ? 'text-red-500' : 'text-foreground'}`}>
                          {isDebt ? '-' : ''}{formatCurrency(Math.abs(balance))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-2">No accounts loaded yet — click Sync All.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
