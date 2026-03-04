'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { goalsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, cn } from '@/lib/utils';
import type { SavingsGoal } from '@/types/models';

export function GoalsView() {
  const { data, error, isLoading, refetch } = useFetch<{ goals: SavingsGoal[] }>(() => goalsApi.list(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [form, setForm] = useState({ name: '', targetAmount: '', deadline: '', priority: 'medium' as const, linkedAccount: '' });

  const createMutation = useMutation(useCallback((d: any) => goalsApi.create(d), []));
  const contribMutation = useMutation(useCallback(({ id, data }: any) => goalsApi.addContribution(id, data), []));
  const deleteMutation = useMutation(useCallback((id: string) => goalsApi.delete(id), []));

  const goals = data?.goals || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutate({
      name: form.name,
      targetAmount: parseFloat(form.targetAmount),
      deadline: form.deadline || undefined,
      priority: form.priority,
      linkedAccount: form.linkedAccount || undefined,
    });
    setForm({ name: '', targetAmount: '', deadline: '', priority: 'medium', linkedAccount: '' });
    setShowAdd(false);
    refetch();
  };

  const handleContribute = async () => {
    if (!contribGoalId || !contribAmount) return;
    await contribMutation.mutate({ id: contribGoalId, data: { amount: parseFloat(contribAmount) } });
    setContribGoalId(null);
    setContribAmount('');
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    await deleteMutation.mutate(id);
    refetch();
  };

  const getProgress = (g: SavingsGoal) => {
    const total = g.currentAmount + g.contributions.reduce((s, c) => s + c.amount, 0);
    return g.targetAmount > 0 ? Math.min(total / g.targetAmount, 1) : 0;
  };

  const getTotalSaved = (g: SavingsGoal) =>
    g.currentAmount + g.contributions.reduce((s, c) => s + c.amount, 0);

  if (isLoading) return <PageLoader message="Loading goals..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Savings Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">{goals.length} goal{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-navy-500 hover:bg-navy-600">
          {showAdd ? 'Cancel' : '+ New Goal'}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-5 space-y-4 animate-slide-down">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Goal Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Emergency Fund" /></div>
            <div><Label>Target Amount ($)</Label><Input type="number" step="0.01" min="1" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} required placeholder="10000" /></div>
            <div><Label>Deadline (optional)</Label><Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            <div>
              <Label>Priority</Label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))} className="flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={createMutation.isLoading} className="bg-navy-500 hover:bg-navy-600">
            {createMutation.isLoading ? 'Creating...' : 'Create Goal'}
          </Button>
          {createMutation.error && <p className="text-sm text-red-500">{createMutation.error}</p>}
        </form>
      )}

      {/* Goals grid */}
      {goals.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8" /></svg>}
          title="No savings goals yet"
          description="Create your first goal to start tracking your savings progress."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const progress = getProgress(g);
            const saved = getTotalSaved(g);
            const remaining = Math.max(g.targetAmount - saved, 0);
            const priorityColor = g.priority === 'high' ? 'text-red-500' : g.priority === 'medium' ? 'text-yellow-500' : 'text-green-500';

            return (
              <div key={g.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{g.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className={cn('font-medium', priorityColor)}>{g.priority}</span>
                      {g.deadline && ` · Due ${g.deadline}`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(g.id)} className="text-muted-foreground/30 hover:text-red-500 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="h-3 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-savings transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs tabnum">
                  <span className="font-semibold">{formatCurrency(saved)}</span>
                  <span className="text-muted-foreground">{formatCurrency(g.targetAmount)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 tabnum">{(progress * 100).toFixed(1)}% · {formatCurrency(remaining)} remaining</p>

                {/* Contribute */}
                {contribGoalId === g.id ? (
                  <div className="flex gap-2 mt-3">
                    <Input type="number" step="0.01" min="0.01" placeholder="Amount" value={contribAmount} onChange={e => setContribAmount(e.target.value)} className="h-8 text-xs" />
                    <Button size="sm" onClick={handleContribute} disabled={contribMutation.isLoading}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setContribGoalId(null)}>✕</Button>
                  </div>
                ) : (
                  <button onClick={() => setContribGoalId(g.id)} className="mt-3 text-xs font-medium text-navy-500 hover:underline">
                    + Add contribution
                  </button>
                )}

                {/* Recent contributions */}
                {g.contributions.length > 0 && (
                  <div className="mt-3 border-t pt-2 space-y-1">
                    {g.contributions.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{c.date}{c.note ? ` — ${c.note}` : ''}</span>
                        <span className="tabnum font-medium text-green-600">+{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                    {g.contributions.length > 3 && <p className="text-[11px] text-muted-foreground">+{g.contributions.length - 3} more</p>}
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
