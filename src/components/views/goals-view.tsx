'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { goalsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type { SavingsGoal } from '@/types/models';

const GOAL_COLORS = [
  'hsl(var(--primary))',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#fb923c',
  '#34d399',
  '#e879f9',
  '#facc15',
];

function GoalRing({ progress, color, size = 88 }: { progress: number; color: string; size?: number }) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(progress, 1));
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="5" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}60)`, transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="13" fontWeight="700" fontFamily="var(--font-mono)">
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

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

  const PRIORITY_COLOR: Record<string, string> = {
    high: 'text-expense',
    medium: 'text-yellow-400',
    low: 'text-primary',
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Savings Goals</p>
            <h1 className="text-xl font-bold tracking-tight">
              {goals.length} goal{goals.length !== 1 ? 's' : ''}
            </h1>
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
            {showAdd ? '✕ Cancel' : '+ New Goal'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="border border-border bg-surface-1 p-5 space-y-4 animate-fade-in">
          <p className="ticker text-primary mb-2">New Goal Configuration</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="ticker">Goal Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Emergency Fund" />
            </div>
            <div className="space-y-1.5">
              <label className="ticker">Target Amount ($)</label>
              <Input type="number" step="0.01" min="1" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} required placeholder="10000" />
            </div>
            <div className="space-y-1.5">
              <label className="ticker">Deadline (optional)</label>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="ticker">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}
                className="flex h-9 w-full border border-border bg-surface-1 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createMutation.isLoading}
              className="h-9 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
            >
              {createMutation.isLoading ? 'Creating...' : 'Create Goal'}
            </button>
            {createMutation.error && <p className="text-xs font-mono text-expense">{createMutation.error}</p>}
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((g, i) => {
            const progress = getProgress(g);
            const saved = getTotalSaved(g);
            const remaining = Math.max(g.targetAmount - saved, 0);
            const color = GOAL_COLORS[i % GOAL_COLORS.length];

            return (
              <div key={g.id} className="border border-border bg-surface-1 p-5 relative overflow-hidden">
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />

                <div className="flex items-start gap-4">
                  <GoalRing progress={progress} color={color} size={88} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold text-sm">{g.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn('ticker', PRIORITY_COLOR[g.priority])}>{g.priority} priority</span>
                          {g.deadline && <span className="ticker">· {g.deadline}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(g.id)} className="text-muted-foreground/30 hover:text-expense transition-colors ml-2 shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      </button>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="numeral text-lg font-bold tabnum" style={{ color }}>{formatCurrency(saved)}</span>
                        <span className="ticker">of {formatCurrency(g.targetAmount)}</span>
                      </div>
                      <p className="ticker">{formatCurrency(remaining)} remaining</p>
                    </div>

                    {/* Contribute */}
                    {contribGoalId === g.id ? (
                      <div className="flex gap-2 mt-3">
                        <Input
                          type="number" step="0.01" min="0.01"
                          placeholder="Amount"
                          value={contribAmount}
                          onChange={e => setContribAmount(e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Button size="sm" onClick={handleContribute} disabled={contribMutation.isLoading}>Add</Button>
                        <button onClick={() => setContribGoalId(null)} className="ticker text-muted-foreground hover:text-foreground px-2">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setContribGoalId(g.id)}
                        className="mt-3 ticker text-primary hover:text-primary/80 transition-colors"
                      >
                        + Add contribution
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent contributions */}
                {g.contributions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                    {g.contributions.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex justify-between items-center">
                        <span className="ticker">{c.date}{c.note ? ` — ${c.note}` : ''}</span>
                        <span className="font-mono text-[11px] font-semibold tabnum text-primary">+{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                    {g.contributions.length > 3 && (
                      <p className="ticker text-muted-foreground/60">+{g.contributions.length - 3} more</p>
                    )}
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
