'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { subscriptionsApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { isRealExpense } from '@/lib/classify';
import type { Subscription, Transaction } from '@/types/models';

type CancelStatus = Subscription['cancelStatus'];

const CANCEL_STATUS_CONFIG: Record<CancelStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',          color: 'text-income',           bg: 'bg-income/10 border-income/30' },
  planned:   { label: 'Plan to cancel',  color: 'text-yellow-400',       bg: 'bg-yellow-500/10 border-yellow-500/30' },
  marked:    { label: 'Marked to cancel',color: 'text-orange-400',       bg: 'bg-orange-500/10 border-orange-500/30' },
  cancelled: { label: 'Cancelled',       color: 'text-muted-foreground', bg: 'bg-surface-3 border-border' },
};

const STATUS_TRANSITIONS: Record<CancelStatus, { label: string; next: CancelStatus }[]> = {
  active:    [{ label: 'Plan to cancel', next: 'planned' }, { label: 'Mark to cancel', next: 'marked' }],
  planned:   [{ label: 'Mark to cancel', next: 'marked'  }, { label: 'Restore',        next: 'active'    }],
  marked:    [{ label: 'Have cancelled', next: 'cancelled'}, { label: 'Restore',        next: 'active'    }],
  cancelled: [{ label: 'Restore',        next: 'active'  }],
};

function toMonthly(sub: Pick<Subscription, 'amount' | 'frequency'>) {
  if (sub.frequency === 'yearly') return sub.amount / 12;
  if (sub.frequency === 'weekly') return sub.amount * 4.33;
  return sub.amount;
}

export function SubscriptionsView() {
  const { data, error, isLoading, refetch } = useFetch<{ subscriptions: Subscription[] }>(
    () => subscriptionsApi.list(), []
  );
  const { data: txData } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 3000, sort: 'date', order: 'desc' }), []
  );

  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({ name: '', amount: '', frequency: 'monthly' as Subscription['frequency'], category: 'Subscriptions' });
  const [candidates, setCandidates] = useState<any[]>([]);
  const [detecting, setDetecting]   = useState(false);
  const [showDetected, setShowDetected] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['active', 'planned', 'marked']));

  const createSub = useMutation(useCallback((d: any) => subscriptionsApi.create(d), []));
  const updateSub = useMutation(useCallback(({ id, data }: any) => subscriptionsApi.update(id, data), []));
  const deleteSub = useMutation(useCallback((id: string) => subscriptionsApi.delete(id), []));

  const subs = data?.subscriptions || [];
  const txns = txData?.transactions || [];

  // ─── "Active last 3 months" — subscriptions found in transaction history ──
  const threeMonthsAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const recentExpenses = txns.filter(t => isRealExpense(t) && t.date >= threeMonthsAgo);
  const knownSubNames = new Set(subs.map(s => s.name.toLowerCase()));

  // Find merchants appearing 2+ times in last 3 months not yet tracked
  const merchantFreq: Record<string, { count: number; amount: number; lastDate: string }> = {};
  for (const t of recentExpenses) {
    const key = t.description.slice(0, 30).toLowerCase().trim();
    if (!merchantFreq[key]) merchantFreq[key] = { count: 0, amount: Math.abs(t.amount), lastDate: t.date };
    merchantFreq[key].count++;
    if (t.date > merchantFreq[key].lastDate) merchantFreq[key].lastDate = t.date;
  }
  const untracked3Month = Object.entries(merchantFreq)
    .filter(([name, d]) => d.count >= 2 && !knownSubNames.has(name))
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 6);

  // ─── Active subscriptions billed last 3 months (tracked) ─────────────────
  const activeLast3 = subs.filter(s => s.cancelStatus !== 'cancelled');

  const monthlyActive = activeLast3
    .filter(s => s.cancelStatus === 'active')
    .reduce((sum, s) => sum + toMonthly(s), 0);
  const monthlyAtRisk = activeLast3
    .filter(s => s.cancelStatus !== 'active')
    .reduce((sum, s) => sum + toMonthly(s), 0);
  const yearlyTotal = (monthlyActive + monthlyAtRisk) * 12;

  // ─── Group by cancelStatus for display ────────────────────────────────────
  const groups: Record<CancelStatus, Subscription[]> = { active: [], planned: [], marked: [], cancelled: [] };
  for (const s of subs) groups[s.cancelStatus].push(s);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleStatusChange = async (sub: Subscription, next: CancelStatus) => {
    const isNowCancelled = next === 'cancelled';
    await updateSub.mutate({ id: sub.id, data: { cancelStatus: next, isActive: !isNowCancelled } });
    refetch();
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch('/api/subscriptions/detect', { method: 'POST' });
      const data = await res.json();
      setCandidates(data.candidates || []);
      setShowDetected(true);
    } catch {}
    setDetecting(false);
  };

  const handleAddCandidate = async (c: any) => {
    await createSub.mutate({ name: c.name, amount: c.amount, frequency: c.frequency, category: c.category || 'Subscriptions', isAutoDetected: true });
    setCandidates(prev => prev.filter(x => x.name !== c.name));
    refetch();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSub.mutate({ name: form.name, amount: parseFloat(form.amount), frequency: form.frequency, category: form.category });
    setForm({ name: '', amount: '', frequency: 'monthly', category: 'Subscriptions' });
    setShowAdd(false);
    refetch();
  };

  if (isLoading) return <PageLoader message="Loading subscriptions..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  const groupOrder: CancelStatus[] = ['active', 'planned', 'marked', 'cancelled'];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="ticker mb-1">Recurring Charges</p>
            <h1 className="text-xl font-bold tracking-tight">Subscriptions</h1>
            <p className="ticker mt-0.5">
              {formatCurrency(monthlyActive)}/mo active
              {monthlyAtRisk > 0 && <span className="text-yellow-400"> · {formatCurrency(monthlyAtRisk)}/mo cancellation queue</span>}
              {' · '}{formatCurrency(yearlyTotal)}/yr total
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDetect} disabled={detecting}
              className="h-9 px-4 border border-border bg-surface-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40">
              {detecting ? 'Scanning...' : 'Auto-Detect'}
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className={cn('h-9 px-4 text-sm font-semibold transition-colors',
                showAdd
                  ? 'border border-border bg-surface-2 text-muted-foreground hover:text-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
              )}>
              {showAdd ? '✕ Cancel' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Active last 3 months — untracked */}
      {untracked3Month.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="ticker text-yellow-400 mb-1">Subscriptions Active in the Past 3 Months</p>
          <p className="text-[10px] text-muted-foreground font-mono mb-3">Recurring charges found in your transactions not yet tracked as subscriptions.</p>
          <div className="space-y-1.5">
            {untracked3Month.map(([name, d]) => (
              <div key={name} className="flex items-center justify-between border border-border bg-surface-1 px-4 py-2.5">
                <div>
                  <p className="text-xs font-medium capitalize">{name}</p>
                  <p className="ticker">{d.count}× in last 90 days · last {d.lastDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="numeral text-xs font-bold tabnum">{formatCurrency(d.amount)}</span>
                  <button
                    onClick={() => handleAddCandidate({ name, amount: d.amount, frequency: 'monthly', category: 'Subscriptions' })}
                    className="text-[11px] font-mono px-2.5 py-1 border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
                    Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-detected */}
      {showDetected && candidates.length > 0 && (
        <div className="border border-primary/30 bg-primary/5 p-5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="ticker text-primary">Detected Subscriptions</p>
            <button onClick={() => setShowDetected(false)} className="ticker text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between border border-border bg-surface-1 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="ticker">{c.frequency} · {c.occurrences} charges · {c.confidence}% confidence</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="numeral text-sm font-bold tabnum">{formatCurrency(c.amount)}</span>
                  <Button size="sm" onClick={() => handleAddCandidate(c)}>Add</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showDetected && candidates.length === 0 && !detecting && (
        <div className="border border-border bg-surface-1 p-4 text-center ticker">No new recurring charges detected.</div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="border border-border bg-surface-1 p-5 animate-fade-in">
          <p className="ticker text-primary mb-3">New Subscription</p>
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="flex-1 min-w-[150px]" />
            <Input type="number" step="0.01" min="0.01" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-32" />
            <Input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-40" />
            <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}
              className="h-9 border border-border bg-surface-1 px-3 text-sm font-mono focus:outline-none focus:border-primary">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
            </select>
            <button type="submit"
              className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors">
              Add
            </button>
          </div>
        </form>
      )}

      {subs.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="No subscriptions tracked"
          description="Add your recurring subscriptions or use Auto-Detect to find them in your transactions."
        />
      ) : (
        <div className="space-y-2">
          {groupOrder.map(status => {
            const group = groups[status];
            if (group.length === 0) return null;
            const cfg = CANCEL_STATUS_CONFIG[status];
            const groupMonthly = group.reduce((s, sub) => s + toMonthly(sub), 0);
            const isExpanded = expandedGroups.has(status);

            return (
              <div key={status} className="border border-border bg-surface-1 overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(status)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('text-[10px] font-semibold font-mono px-2 py-0.5 border', cfg.color, cfg.bg)}>
                      {cfg.label.toUpperCase()}
                    </span>
                    <span className="ticker">{group.length} subscription{group.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="numeral text-sm font-bold tabnum">{formatCurrency(groupMonthly)}/mo</span>
                    <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Group rows */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {group.map(sub => {
                      const monthly = toMonthly(sub);
                      const transitions = STATUS_TRANSITIONS[sub.cancelStatus];

                      return (
                        <div key={sub.id} className={cn('px-4 py-3 flex items-center gap-3', sub.cancelStatus === 'cancelled' && 'opacity-50')}>
                          {/* Category tag */}
                          <div className="w-1 self-stretch bg-border shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{sub.name}</p>
                              {sub.isAutoDetected && (
                                <span className="ticker text-[9px] px-1.5 py-0.5 bg-surface-3 text-muted-foreground">auto</span>
                              )}
                            </div>
                            <p className="ticker text-[10px] mt-0.5">
                              {sub.category}
                              {' · '}
                              <span className="capitalize">{sub.frequency}</span>
                              {sub.nextBillDate && ` · next ${sub.nextBillDate}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="numeral text-sm font-bold tabnum">{formatCurrency(sub.amount)}</span>
                            <span className="ticker text-[10px] text-muted-foreground">
                              {sub.frequency !== 'monthly' && `(${formatCurrency(monthly)}/mo)`}
                            </span>
                          </div>

                          {/* Status transitions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {transitions.map(({ label, next }) => (
                              <button
                                key={next}
                                onClick={() => handleStatusChange(sub, next)}
                                className={cn(
                                  'text-[10px] font-mono px-2 py-1 border transition-colors whitespace-nowrap',
                                  next === 'active'    ? 'border-income/40 text-income hover:bg-income/10'
                                  : next === 'cancelled' ? 'border-border text-muted-foreground hover:border-expense/40 hover:text-expense'
                                  : 'border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10'
                                )}
                              >
                                {label}
                              </button>
                            ))}
                            <button
                              onClick={async () => { if (confirm('Delete?')) { await deleteSub.mutate(sub.id); refetch(); } }}
                              className="text-muted-foreground/30 hover:text-expense transition-colors ml-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
