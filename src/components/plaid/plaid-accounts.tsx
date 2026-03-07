'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatDate, formatCurrency } from '@/lib/utils';
import { accountNicknamesApi } from '@/lib/api-client';

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
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/plaid/accounts');
      const data = await res.json();
      setInstitutions(data.institutions || []);
    } catch {}
  };

  const fetchNicknames = async () => {
    try {
      const res = await accountNicknamesApi.list();
      const map: Record<string, string> = {};
      for (const n of res.nicknames || []) map[n.accountName] = n.nickname;
      setNicknameMap(map);
    } catch {}
  };

  const saveNickname = async (accountName: string) => {
    if (!nicknameValue.trim()) return;
    await accountNicknamesApi.upsert({ accountName, nickname: nicknameValue.trim() });
    setEditingNickname(null);
    setNicknameValue('');
    fetchNicknames();
  };

  useEffect(() => { fetchAccounts(); fetchNicknames(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncSuccess(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const parts = [`${data.added} new`, `${data.modified} updated`, `${data.removed} removed`];
        if (data.reconciled > 0) parts.push(`${data.reconciled} duplicates reconciled`);
        setSyncResult(`Synced: ${parts.join(', ')}`);
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
                  const nickname = nicknameMap[acct.name];
                  const isEditing = editingNickname === acct.name;
                  return (
                    <div key={acct.id} className="bg-background px-3 py-2 border space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <AccountTypeBadge type={acct.type} subtype={acct.subtype} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {nickname || acct.name}{acct.mask ? ` ····${acct.mask}` : ''}
                              </p>
                              <button
                                onClick={() => { setEditingNickname(acct.name); setNicknameValue(nickname || ''); }}
                                className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors"
                                title={nickname ? 'Edit nickname' : 'Add nickname'}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </div>
                            {nickname && (
                              <p className="text-[10px] text-muted-foreground truncate">{acct.name}</p>
                            )}
                            {!nickname && acct.officialName && acct.officialName !== acct.name && (
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
                      {isEditing && (
                        <div className="flex items-center gap-1.5 pl-6">
                          <input
                            type="text"
                            value={nicknameValue}
                            onChange={e => setNicknameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveNickname(acct.name); if (e.key === 'Escape') setEditingNickname(null); }}
                            placeholder="Nickname..."
                            autoFocus
                            className="h-6 w-36 px-2 text-[11px] bg-muted border border-border focus:border-primary outline-none"
                          />
                          <button onClick={() => saveNickname(acct.name)} className="text-[11px] text-primary hover:text-primary/70 font-medium">Save</button>
                          <button onClick={() => setEditingNickname(null)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
                        </div>
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
