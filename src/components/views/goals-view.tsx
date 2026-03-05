'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { goalsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type { SavingsGoal } from '@/types/models';

/* ── Types ── */
interface Asset { id: string; name: string; value: number; type: string; }

/* ── Waterfall logic ── */
function computeWaterfall(goals: SavingsGoal[], balance: number) {
  const sorted = [...goals].sort((a, b) => (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0));
  let remaining = balance;
  return sorted.map(g => {
    const allocated = Math.min(remaining, g.targetAmount);
    remaining = Math.max(0, remaining - g.targetAmount);
    return {
      ...g,
      effectiveSaved: allocated,
      progress: g.targetAmount > 0 ? allocated / g.targetAmount : 0,
      isComplete: allocated >= g.targetAmount,
    };
  });
}

/* ── Small ring for standalone goals ── */
function GoalRing({ progress, color, size = 80 }: { progress: number; color: string; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="5" />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(progress, 1))}
        transform={`rotate(-90 ${cx} ${cx})`} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

const COLORS = ['hsl(var(--primary))', '#60a5fa', '#f472b6', '#fb923c', '#34d399', '#e879f9', '#facc15', '#a78bfa'];

/* ── Main view ── */
export function GoalsView() {
  const { data, error, isLoading, refetch } = useFetch<{ goals: SavingsGoal[]; assets: Asset[] }>(
    () => goalsApi.list(), []
  );
  const [showAdd, setShowAdd] = useState(false);
  const [contribGoalId, setContribGoalId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [form, setForm] = useState({
    name: '', targetAmount: '', deadline: '',
    linkedAccount: '', priorityOrder: '',
  });

  const createMutation = useMutation(useCallback((d: any) => goalsApi.create(d), []));
  const updateMutation = useMutation(useCallback(({ id, data }: any) => goalsApi.update(id, data), []));
  const contribMutation = useMutation(useCallback(({ id, data }: any) => goalsApi.addContribution(id, data), []));
  const deleteMutation = useMutation(useCallback((id: string) => goalsApi.delete(id), []));

  const goals: SavingsGoal[] = data?.goals || [];
  const assets: Asset[] = data?.assets || [];

  // Separate account-linked vs standalone goals
  const linkedGoals = goals.filter(g => g.linkedAccount);
  const standaloneGoals = goals.filter(g => !g.linkedAccount);

  // Group linked goals by account
  const accountGroups = linkedGoals.reduce((acc, g) => {
    const key = g.linkedAccount!;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {} as Record<string, SavingsGoal[]>);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Default priorityOrder: one after the last in this account's stack
    let order = parseInt(form.priorityOrder) || 0;
    if (!order && form.linkedAccount) {
      const existing = linkedGoals.filter(g => g.linkedAccount === form.linkedAccount);
      order = existing.length > 0
        ? Math.max(...existing.map(g => g.priorityOrder ?? 0)) + 1
        : 1;
    }
    await createMutation.mutate({
      name: form.name,
      targetAmount: parseFloat(form.targetAmount),
      deadline: form.deadline || undefined,
      linkedAccount: form.linkedAccount || undefined,
      priorityOrder: order,
      priority: 'medium',
    });
    setForm({ name: '', targetAmount: '', deadline: '', linkedAccount: '', priorityOrder: '' });
    setShowAdd(false);
    refetch();
  };

  const handleReorder = async (goal: SavingsGoal, direction: 'up' | 'down') => {
    const siblings = [...(accountGroups[goal.linkedAccount!] || [])]
      .sort((a, b) => (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0));
    const idx = siblings.findIndex(g => g.id === goal.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const sibling = siblings[swapIdx];
    await Promise.all([
      updateMutation.mutate({ id: goal.id, data: { priorityOrder: sibling.priorityOrder ?? 0 } }),
      updateMutation.mutate({ id: sibling.id, data: { priorityOrder: goal.priorityOrder ?? 0 } }),
    ]);
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

  if (isLoading) return <PageLoader message="Loading goals..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Savings Goals</p>
            <h1 className="text-xl font-bold tracking-tight">{goals.length} goal{goals.length !== 1 ? 's' : ''}</h1>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={cn('h-9 px-4 text-sm font-semibold transition-colors',
              showAdd
                ? 'border border-border bg-surface-2 text-muted-foreground hover:text-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/85'
            )}
          >
            {showAdd ? '✕ Cancel' : '+ New Goal'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="border border-border bg-surface-1 p-5 space-y-4 animate-fade-in">
          <p className="ticker text-primary">New Goal</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="ticker">Goal Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Emergency Fund" />
            </div>
            <div className="space-y-1.5">
              <label className="ticker">Target ($)</label>
              <Input type="number" step="0.01" min="1" value={form.targetAmount}
                onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} required placeholder="1000" />
            </div>
            <div className="space-y-1.5">
              <label className="ticker">Link to Account <span className="text-muted-foreground/60">(optional)</span></label>
              <select
                value={form.linkedAccount}
                onChange={e => setForm(f => ({ ...f, linkedAccount: e.target.value }))}
                className="flex h-9 w-full border border-border bg-surface-1 px-3 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">— No account link —</option>
                {assets.map(a => (
                  <option key={a.id} value={a.name}>{a.name} ({formatCurrency(a.value)})</option>
                ))}
              </select>
            </div>
            {form.linkedAccount ? (
              <div className="space-y-1.5">
                <label className="ticker">Priority <span className="text-muted-foreground/60">(1 = funded first)</span></label>
                <Input type="number" min="1" value={form.priorityOrder}
                  onChange={e => setForm(f => ({ ...f, priorityOrder: e.target.value }))}
                  placeholder={String((accountGroups[form.linkedAccount]?.length ?? 0) + 1)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="ticker">Deadline <span className="text-muted-foreground/60">(optional)</span></label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            )}
          </div>
          {form.linkedAccount && (
            <p className="text-[11px] text-muted-foreground border border-border bg-surface-2 px-3 py-2">
              The balance of <span className="font-semibold text-foreground">{form.linkedAccount}</span> will automatically fill this goal in stack order — no manual contributions needed.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={createMutation.isLoading}
              className="h-9 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40">
              {createMutation.isLoading ? 'Creating...' : 'Create Goal'}
            </button>
            {createMutation.error && <p className="text-xs font-mono text-expense">{createMutation.error}</p>}
          </div>
        </form>
      )}

      {goals.length === 0 && (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8" /></svg>}
          title="No savings goals yet"
          description="Create your first goal to start tracking your savings progress."
        />
      )}

      {/* Account-linked waterfall stacks */}
      {Object.entries(accountGroups).map(([accountName, stackGoals]) => {
        const asset = assets.find(a => a.name === accountName);
        const balance = asset?.value ?? 0;
        const waterfall = computeWaterfall(stackGoals, balance);
        const totalTarget = stackGoals.reduce((s, g) => s + g.targetAmount, 0);
        const overallPct = totalTarget > 0 ? Math.min(balance / totalTarget, 1) : 0;

        return (
          <div key={accountName} className="border border-border bg-surface-1 overflow-hidden">
            {/* Account header */}
            <div className="flex items-center justify-between px-5 py-3 bg-surface-2 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold">{accountName}</p>
                  <p className="ticker">Balance: <span className="font-mono font-semibold text-foreground">{formatCurrency(balance)}</span> · {Math.round(overallPct * 100)}% of {formatCurrency(totalTarget)} total target</p>
                </div>
              </div>
            </div>

            {/* Overall balance bar */}
            <div className="h-1.5 bg-surface-3">
              <div className="h-full bg-primary transition-all duration-700"
                style={{ width: `${overallPct * 100}%` }} />
            </div>

            {/* Waterfall goals */}
            <div className="divide-y divide-border">
              {waterfall.map((g, idx) => {
                const color = COLORS[idx % COLORS.length];
                const siblings = waterfall;

                return (
                  <div key={g.id} className={cn('px-5 py-4 flex items-center gap-4', g.isComplete && 'bg-income/3')}>
                    {/* Position badge */}
                    <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ borderColor: color, color: g.isComplete ? 'white' : color, backgroundColor: g.isComplete ? color : 'transparent' }}>
                      {g.isComplete ? '✓' : idx + 1}
                    </div>

                    {/* Goal info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <p className="text-sm font-semibold truncate">{g.name}</p>
                        <p className="tabnum text-sm font-bold ml-3 shrink-0" style={{ color }}>
                          {formatCurrency(g.effectiveSaved)} <span className="text-muted-foreground font-normal text-xs">/ {formatCurrency(g.targetAmount)}</span>
                        </p>
                      </div>
                      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${g.progress * 100}%`, backgroundColor: color }} />
                      </div>
                      {!g.isComplete && (
                        <p className="ticker mt-1">{formatCurrency(g.targetAmount - g.effectiveSaved)} needed to unlock</p>
                      )}
                    </div>

                    {/* Reorder + delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleReorder(g, 'up')}
                        disabled={idx === 0}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        title="Move up"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 8l4-4 4 4"/></svg>
                      </button>
                      <button
                        onClick={() => handleReorder(g, 'down')}
                        disabled={idx === siblings.length - 1}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        title="Move down"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l4 4 4-4"/></svg>
                      </button>
                      <button onClick={() => handleDelete(g.id)}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground/30 hover:text-expense transition-colors ml-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add goal to this account shortcut */}
            <button
              onClick={() => { setShowAdd(true); setForm(f => ({ ...f, linkedAccount: accountName, priorityOrder: String(stackGoals.length + 1) })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="w-full px-5 py-2.5 text-xs font-mono text-muted-foreground hover:text-primary hover:bg-surface-2 transition-colors text-left border-t border-border"
            >
              + Add goal to {accountName}
            </button>
          </div>
        );
      })}

      {/* Standalone goals grid */}
      {standaloneGoals.length > 0 && (
        <>
          {Object.keys(accountGroups).length > 0 && (
            <p className="ticker text-muted-foreground px-1">Standalone Goals</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {standaloneGoals.map((g, i) => {
              const saved = g.currentAmount + g.contributions.reduce((s, c) => s + c.amount, 0);
              const progress = g.targetAmount > 0 ? Math.min(saved / g.targetAmount, 1) : 0;
              const remaining = Math.max(g.targetAmount - saved, 0);
              const color = COLORS[(Object.keys(accountGroups).length + i) % COLORS.length];

              return (
                <div key={g.id} className="border border-border bg-surface-1 p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />
                  <div className="flex items-start gap-4">
                    <GoalRing progress={progress} color={color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-bold text-sm">{g.name}</h3>
                        <button onClick={() => handleDelete(g.id)} className="text-muted-foreground/30 hover:text-expense transition-colors ml-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                        </button>
                      </div>
                      {g.deadline && <p className="ticker mb-2">Due {g.deadline}</p>}
                      <div className="flex justify-between items-baseline">
                        <span className="numeral text-lg font-bold tabnum" style={{ color }}>{formatCurrency(saved)}</span>
                        <span className="ticker">of {formatCurrency(g.targetAmount)}</span>
                      </div>
                      <p className="ticker mt-0.5">{formatCurrency(remaining)} remaining</p>

                      {contribGoalId === g.id ? (
                        <div className="flex gap-2 mt-3">
                          <Input type="number" step="0.01" min="0.01" placeholder="Amount"
                            value={contribAmount} onChange={e => setContribAmount(e.target.value)}
                            className="h-7 text-xs" />
                          <button onClick={handleContribute} disabled={contribMutation.isLoading}
                            className="h-7 px-3 bg-primary text-primary-foreground text-xs font-semibold">Add</button>
                          <button onClick={() => setContribGoalId(null)} className="ticker text-muted-foreground px-1">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setContribGoalId(g.id)}
                          className="mt-3 ticker text-primary hover:text-primary/80 transition-colors">
                          + Add contribution
                        </button>
                      )}
                    </div>
                  </div>

                  {g.contributions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border space-y-1">
                      {g.contributions.slice(0, 3).map(c => (
                        <div key={c.id} className="flex justify-between items-center">
                          <span className="ticker">{c.date}{c.note ? ` — ${c.note}` : ''}</span>
                          <span className="font-mono text-[11px] font-semibold tabnum text-primary">+{formatCurrency(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
