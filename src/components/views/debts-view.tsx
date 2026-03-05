'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { debtsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type { Debt } from '@/types/models';

function calcPayoffMonths(balance: number, rate: number, payment: number, extra: number): number {
  if (payment + extra <= 0) return Infinity;
  const monthlyRate = rate / 100 / 12;
  if (monthlyRate === 0) return Math.ceil(balance / (payment + extra));
  let bal = balance;
  let months = 0;
  while (bal > 0 && months < 600) {
    const interest = bal * monthlyRate;
    bal = bal + interest - (payment + extra);
    months++;
  }
  return months;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  mortgage: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  auto: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
  ),
  student: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
  ),
  credit_card: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
  ),
  personal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  ),
  other: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  ),
};

const TYPE_LABELS: Record<string, string> = {
  mortgage: 'Mortgage', auto: 'Auto', student: 'Student',
  credit_card: 'Credit Card', personal: 'Personal', other: 'Other',
};

export function DebtsView() {
  const { data, error, isLoading, refetch } = useFetch<{ debts: Debt[] }>(() => debtsApi.list(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', balance: '', originalBalance: '', interestRate: '', minimumPayment: '',
    extraPayment: '0', type: 'other' as Debt['type'], dueDay: '1',
  });

  const createMutation = useMutation(useCallback((d: any) => debtsApi.create(d), []));
  const deleteMutation = useMutation(useCallback((id: string) => debtsApi.delete(id), []));

  const debts = data?.debts || [];
  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const totalOriginal = debts.reduce((s, d) => s + d.originalBalance, 0);
  const overallProgress = totalOriginal > 0 ? (1 - totalBalance / totalOriginal) : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutate({
      name: form.name,
      balance: parseFloat(form.balance),
      originalBalance: parseFloat(form.originalBalance || form.balance),
      interestRate: parseFloat(form.interestRate),
      minimumPayment: parseFloat(form.minimumPayment),
      extraPayment: parseFloat(form.extraPayment || '0'),
      type: form.type,
      dueDay: parseInt(form.dueDay),
    });
    setForm({ name: '', balance: '', originalBalance: '', interestRate: '', minimumPayment: '', extraPayment: '0', type: 'other', dueDay: '1' });
    setShowAdd(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this debt?')) return;
    await deleteMutation.mutate(id);
    refetch();
  };

  if (isLoading) return <PageLoader message="Loading debts..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Debt Tracker</p>
            <h1 className="text-xl font-bold tracking-tight">
              {formatCurrency(totalBalance)} remaining
            </h1>
            {totalOriginal > 0 && (
              <p className="ticker mt-0.5">of {formatCurrency(totalOriginal)} original</p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={cn(
              'h-9 px-4 text-sm font-semibold transition-colors',
              showAdd
                ? 'border border-border bg-surface-2 text-muted-foreground hover:text-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
            )}
          >
            {showAdd ? '✕ Cancel' : '+ Add Debt'}
          </button>
        </div>
      </div>

      {/* Overall progress */}
      {debts.length > 0 && (
        <div className="border border-border bg-surface-1 px-5 py-4">
          <div className="flex justify-between items-baseline mb-3">
            <p className="ticker">Overall Payoff Progress</p>
            <span className="numeral font-bold text-lg tabnum text-primary">{(overallProgress * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{
                width: `${overallProgress * 100}%`,
                boxShadow: '0 0 8px hsl(var(--primary) / 0.4)',
              }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="border border-border bg-surface-1 p-5 space-y-4 animate-fade-in">
          <p className="ticker text-primary mb-2">New Debt Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><label className="ticker">Name</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Student Loan" /></div>
            <div className="space-y-1.5"><label className="ticker">Current Balance ($)</label><Input type="number" step="0.01" min="0" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} required /></div>
            <div className="space-y-1.5"><label className="ticker">Original Balance ($)</label><Input type="number" step="0.01" min="0" value={form.originalBalance} onChange={e => setForm(f => ({ ...f, originalBalance: e.target.value }))} placeholder="Same as current if new" /></div>
            <div className="space-y-1.5"><label className="ticker">Interest Rate (%)</label><Input type="number" step="0.01" min="0" max="100" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} required /></div>
            <div className="space-y-1.5"><label className="ticker">Min Payment ($)</label><Input type="number" step="0.01" min="0" value={form.minimumPayment} onChange={e => setForm(f => ({ ...f, minimumPayment: e.target.value }))} required /></div>
            <div className="space-y-1.5"><label className="ticker">Extra Payment ($)</label><Input type="number" step="0.01" min="0" value={form.extraPayment} onChange={e => setForm(f => ({ ...f, extraPayment: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <label className="ticker">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="flex h-9 w-full border border-border bg-surface-1 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="h-9 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
          >
            {createMutation.isLoading ? 'Adding...' : 'Add Debt'}
          </button>
        </form>
      )}

      {debts.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
          title="No debts tracked"
          description="Add your debts to track payoff progress and see amortization schedules."
        />
      ) : (
        <div className="space-y-3">
          {debts.map((d) => {
            const progress = d.originalBalance > 0 ? 1 - d.balance / d.originalBalance : 0;
            const months = calcPayoffMonths(d.balance, d.interestRate, d.minimumPayment, d.extraPayment);
            const payoffDate = months < 600
              ? new Date(Date.now() + months * 30.44 * 86400000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              : 'Never';

            return (
              <div key={d.id} className="border border-border bg-surface-1 p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-expense/60" />

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-6 h-6 flex items-center justify-center bg-surface-3 text-muted-foreground">
                        {TYPE_ICONS[d.type]}
                      </div>
                      <h3 className="font-bold text-sm">{d.name}</h3>
                      <span className="ticker">{TYPE_LABELS[d.type]}</span>
                    </div>
                    <p className="ticker ml-8">{d.interestRate}% APR · Due day {d.dueDay}</p>
                  </div>
                  <button onClick={() => handleDelete(d.id)} className="text-muted-foreground/30 hover:text-expense transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="numeral text-xl font-bold tabnum text-expense">{formatCurrency(d.balance)}</span>
                    <span className="ticker text-primary">{(progress * 100).toFixed(1)}% paid off</span>
                  </div>
                  <div className="h-1.5 bg-surface-3 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${progress * 100}%`, boxShadow: '0 0 6px hsl(var(--primary) / 0.4)' }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <div>
                    <p className="ticker mb-1">Monthly Payment</p>
                    <p className="numeral text-base font-bold tabnum">{formatCurrency(d.minimumPayment + d.extraPayment)}</p>
                  </div>
                  <div>
                    <p className="ticker mb-1">Months Left</p>
                    <p className="numeral text-base font-bold tabnum">{months < 600 ? months : '∞'}</p>
                  </div>
                  <div>
                    <p className="ticker mb-1">Payoff Date</p>
                    <p className="numeral text-base font-bold">{payoffDate}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
