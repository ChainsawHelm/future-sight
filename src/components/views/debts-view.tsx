'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { debtsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const typeLabels: Record<string, string> = {
    mortgage: '🏠 Mortgage', auto: '🚗 Auto', student: '🎓 Student',
    credit_card: '💳 Credit Card', personal: '🤝 Personal', other: '📄 Other',
  };

  if (isLoading) return <PageLoader message="Loading debts..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Debt Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency(totalBalance)} remaining of {formatCurrency(totalOriginal)}
          </p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-navy-500 hover:bg-navy-600">
          {showAdd ? 'Cancel' : '+ Add Debt'}
        </Button>
      </div>

      {/* Total progress */}
      {debts.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Overall Payoff Progress</span>
            <span className="tabnum font-semibold">{totalOriginal > 0 ? ((1 - totalBalance / totalOriginal) * 100).toFixed(1) : 0}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${totalOriginal > 0 ? (1 - totalBalance / totalOriginal) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-5 space-y-4 animate-slide-down">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Student Loan" /></div>
            <div><Label>Current Balance ($)</Label><Input type="number" step="0.01" min="0" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} required /></div>
            <div><Label>Original Balance ($)</Label><Input type="number" step="0.01" min="0" value={form.originalBalance} onChange={e => setForm(f => ({ ...f, originalBalance: e.target.value }))} placeholder="Same as current if new" /></div>
            <div><Label>Interest Rate (%)</Label><Input type="number" step="0.01" min="0" max="100" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} required /></div>
            <div><Label>Minimum Payment ($)</Label><Input type="number" step="0.01" min="0" value={form.minimumPayment} onChange={e => setForm(f => ({ ...f, minimumPayment: e.target.value }))} required /></div>
            <div><Label>Extra Payment ($)</Label><Input type="number" step="0.01" min="0" value={form.extraPayment} onChange={e => setForm(f => ({ ...f, extraPayment: e.target.value }))} /></div>
            <div>
              <Label>Type</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className="flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={createMutation.isLoading} className="bg-navy-500 hover:bg-navy-600">
            {createMutation.isLoading ? 'Adding...' : 'Add Debt'}
          </Button>
        </form>
      )}

      {debts.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
          title="No debts tracked"
          description="Add your debts to track payoff progress and see amortization schedules."
        />
      ) : (
        <div className="space-y-4">
          {debts.map((d) => {
            const progress = d.originalBalance > 0 ? 1 - d.balance / d.originalBalance : 0;
            const months = calcPayoffMonths(d.balance, d.interestRate, d.minimumPayment, d.extraPayment);
            const payoffDate = months < 600
              ? new Date(Date.now() + months * 30.44 * 86400000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              : 'Never';

            return (
              <div key={d.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{d.name}</h3>
                      <span className="text-xs text-muted-foreground">{typeLabels[d.type]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.interestRate}% APR · Due day {d.dueDay}</p>
                  </div>
                  <button onClick={() => handleDelete(d.id)} className="text-muted-foreground/30 hover:text-red-500 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>

                <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs tabnum">
                  <span className="text-red-600 font-semibold">{formatCurrency(d.balance)} remaining</span>
                  <span className="text-muted-foreground">{(progress * 100).toFixed(1)}% paid</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t">
                  <div><p className="text-[11px] text-muted-foreground">Monthly Payment</p><p className="text-sm font-semibold tabnum">{formatCurrency(d.minimumPayment + d.extraPayment)}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Months Left</p><p className="text-sm font-semibold tabnum">{months < 600 ? months : '∞'}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Payoff Date</p><p className="text-sm font-semibold">{payoffDate}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
