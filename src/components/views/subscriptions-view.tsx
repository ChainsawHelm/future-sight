'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { subscriptionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type { Subscription } from '@/types/models';

export function SubscriptionsView() {
  const { data, error, isLoading, refetch } = useFetch<{ subscriptions: Subscription[] }>(() => subscriptionsApi.list(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', frequency: 'monthly' as Subscription['frequency'] });
  const [candidates, setCandidates] = useState<any[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [showDetected, setShowDetected] = useState(false);

  const createSub = useMutation(useCallback((d: any) => subscriptionsApi.create(d), []));
  const updateSub = useMutation(useCallback(({ id, data }: any) => subscriptionsApi.update(id, data), []));
  const deleteSub = useMutation(useCallback((id: string) => subscriptionsApi.delete(id), []));

  const subs = data?.subscriptions || [];
  const activeSubs = subs.filter(s => s.isActive);

  const monthlyTotal = activeSubs.reduce((s, sub) => {
    if (sub.frequency === 'yearly') return s + sub.amount / 12;
    if (sub.frequency === 'weekly') return s + sub.amount * 4.33;
    return s + sub.amount;
  }, 0);

  const yearlyTotal = monthlyTotal * 12;

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
    await createSub.mutate({ name: c.name, amount: c.amount, frequency: c.frequency, category: c.category, isAutoDetected: true });
    setCandidates(prev => prev.filter(x => x.name !== c.name));
    refetch();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSub.mutate({ name: form.name, amount: parseFloat(form.amount), frequency: form.frequency });
    setForm({ name: '', amount: '', frequency: 'monthly' });
    setShowAdd(false);
    refetch();
  };

  const toggleActive = async (sub: Subscription) => {
    await updateSub.mutate({ id: sub.id, data: { isActive: !sub.isActive } });
    refetch();
  };

  if (isLoading) return <PageLoader message="Loading subscriptions..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Recurring Charges</p>
            <h1 className="text-xl font-bold tracking-tight">Subscriptions</h1>
            <p className="ticker mt-0.5">{activeSubs.length} active · {formatCurrency(monthlyTotal)}/mo · {formatCurrency(yearlyTotal)}/yr</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDetect}
              disabled={detecting}
              className="h-9 px-4 border border-border bg-surface-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40"
            >
              {detecting ? 'Scanning...' : 'Auto-Detect'}
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className={cn(
                'h-9 px-4 text-sm font-semibold transition-colors',
                showAdd
                  ? 'border border-border bg-surface-2 text-muted-foreground hover:text-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
              )}
            >
              {showAdd ? '✕ Cancel' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

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
        <div className="border border-border bg-surface-1 p-4 text-center ticker">
          No new recurring charges detected.
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="border border-border bg-surface-1 p-5 animate-fade-in">
          <p className="ticker text-primary mb-3">New Subscription</p>
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="flex-1 min-w-[150px]" />
            <Input type="number" step="0.01" min="0.01" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-32" />
            <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}
              className="h-9 border border-border bg-surface-1 px-3 text-sm font-mono focus:outline-none focus:border-primary">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
            </select>
            <button type="submit"
              className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
              Add
            </button>
          </div>
        </form>
      )}

      {subs.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="No subscriptions"
          description="Add your recurring subscriptions to track monthly costs."
        />
      ) : (
        <div className="space-y-2">
          {subs.map((sub) => (
            <div key={sub.id} className={cn(
              'flex items-center justify-between border border-border bg-surface-1 px-5 py-4 transition-opacity',
              !sub.isActive && 'opacity-40'
            )}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleActive(sub)}
                  className={cn(
                    'w-5 h-5 flex items-center justify-center transition-colors border',
                    sub.isActive ? 'border-primary bg-primary' : 'border-border bg-surface-3'
                  )}
                >
                  {sub.isActive && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
                <div>
                  <p className="text-sm font-medium">{sub.name}</p>
                  <p className="ticker capitalize">{sub.frequency}{sub.nextBillDate ? ` · Next: ${sub.nextBillDate}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="numeral text-sm font-bold tabnum">{formatCurrency(sub.amount)}</span>
                <button
                  onClick={async () => { if (confirm('Delete?')) { await deleteSub.mutate(sub.id); refetch(); } }}
                  className="text-muted-foreground/30 hover:text-expense transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
