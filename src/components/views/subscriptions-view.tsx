'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { subscriptionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    const amt = sub.amount;
    if (sub.frequency === 'yearly') return s + amt / 12;
    if (sub.frequency === 'weekly') return s + amt * 4.33;
    return s + amt;
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeSubs.length} active · {formatCurrency(monthlyTotal)}/mo · {formatCurrency(yearlyTotal)}/yr</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDetect} disabled={detecting}>
            {detecting ? 'Scanning...' : '🔍 Auto-Detect'}
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)} className="bg-navy-500 hover:bg-navy-600">{showAdd ? 'Cancel' : '+ Add'}</Button>
        </div>
      </div>

      {/* Auto-detected candidates */}
      {showDetected && candidates.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-5 space-y-3 animate-slide-down">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Detected Subscriptions</h2>
            <button onClick={() => setShowDetected(false)} className="text-xs text-muted-foreground hover:underline">Dismiss</button>
          </div>
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-card rounded-lg px-4 py-3 border">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.frequency} · {c.occurrences} charges found · {c.confidence}% confidence</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabnum">{formatCurrency(c.amount)}</span>
                  <Button size="sm" onClick={() => handleAddCandidate(c)}>Add</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showDetected && candidates.length === 0 && !detecting && (
        <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
          No new recurring charges detected. All known patterns are already tracked.
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-5 space-y-4 animate-slide-down">
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="flex-1 min-w-[150px]" />
            <Input type="number" step="0.01" min="0.01" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-32" />
            <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))} className="h-10 rounded-lg border bg-background px-3 text-sm">
              <option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="weekly">Weekly</option>
            </select>
            <Button type="submit" className="bg-navy-500 hover:bg-navy-600">Add</Button>
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
            <div key={sub.id} className={cn('flex items-center justify-between rounded-xl border bg-card px-5 py-4 shadow-sm transition-opacity', !sub.isActive && 'opacity-50')}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleActive(sub)} className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  sub.isActive ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'
                )}>
                  {sub.isActive && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                </button>
                <div>
                  <p className="text-sm font-medium">{sub.name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{sub.frequency}{sub.nextBillDate ? ` · Next: ${sub.nextBillDate}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabnum">{formatCurrency(sub.amount)}</span>
                <button onClick={async () => { if (confirm('Delete?')) { await deleteSub.mutate(sub.id); refetch(); } }}
                  className="text-muted-foreground/30 hover:text-red-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
