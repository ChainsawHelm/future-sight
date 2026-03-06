'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useCategories } from '@/hooks/use-data';
import { budgetsApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { isRealExpense } from '@/lib/classify';
import type { Budget, Transaction } from '@/types/models';

// ─── Helpers ────────────────────────────────────

/** Round a number up to a "nice" budget number */
function roundToNice(n: number): number {
  if (n <= 0) return 0;
  if (n <= 10) return Math.ceil(n / 5) * 5;        // 7 → 10
  if (n <= 50) return Math.ceil(n / 10) * 10;       // 34 → 40
  if (n <= 100) return Math.ceil(n / 25) * 25;      // 87 → 100
  if (n <= 500) return Math.ceil(n / 25) * 25;      // 123 → 125
  if (n <= 1000) return Math.ceil(n / 50) * 50;     // 478 → 500
  return Math.ceil(n / 100) * 100;                   // 1234 → 1300
}

/** Format a date for YYYY-MM-DD range */
function monthRange(year: number, month: number): { start: string; end: string } {
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ─── Auto-Build Modal ───────────────────────────

interface SuggestedBudget {
  category: string;
  avgSpend: number;
  suggestedLimit: number;
  enabled: boolean;
}

function AutoBuildModal({
  onClose,
  onAccept,
  existingBudgets,
}: {
  onClose: () => void;
  onAccept: (budgets: { category: string; monthlyLimit: number; rollover: boolean }[]) => void;
  existingBudgets: Budget[];
}) {
  const [suggestions, setSuggestions] = useState<SuggestedBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      try {
        const now = new Date();
        // Fetch last 3 months of transactions
        const months: { start: string; end: string }[] = [];
        for (let i = 1; i <= 3; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(monthRange(d.getFullYear(), d.getMonth()));
        }

        const allTxns: Transaction[] = [];
        for (const m of months) {
          const res = await transactionsApi.list({ limit: 500, dateFrom: m.start, dateTo: m.end });
          if (res?.transactions) allTxns.push(...res.transactions);
        }

        if (cancelled) return;

        // Filter to real expenses only
        const expenses = allTxns.filter(t => isRealExpense(t));

        // Sum spending per category per month
        const catMonthSpend: Record<string, Record<string, number>> = {};
        for (const t of expenses) {
          const monthKey = t.date.slice(0, 7); // YYYY-MM
          if (!catMonthSpend[t.category]) catMonthSpend[t.category] = {};
          catMonthSpend[t.category][monthKey] = (catMonthSpend[t.category][monthKey] || 0) + Math.abs(t.amount);
        }

        // Calculate average and build suggestions
        const existingMap = new Map(existingBudgets.map(b => [b.category, b]));
        const numMonths = months.length;

        const suggs: SuggestedBudget[] = Object.entries(catMonthSpend)
          .map(([category, monthMap]) => {
            const totalSpend = Object.values(monthMap).reduce((s, v) => s + v, 0);
            const avgSpend = totalSpend / numMonths;
            const suggestedLimit = roundToNice(avgSpend);
            return {
              category,
              avgSpend,
              suggestedLimit,
              enabled: !existingMap.has(category), // pre-check categories that don't already have a budget
            };
          })
          .sort((a, b) => b.avgSpend - a.avgSpend);

        setSuggestions(suggs);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to analyze spending');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    analyze();
    return () => { cancelled = true; };
  }, [existingBudgets]);

  const toggleSuggestion = (cat: string) => {
    setSuggestions(prev => prev.map(s => s.category === cat ? { ...s, enabled: !s.enabled } : s));
  };

  const updateLimit = (cat: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    setSuggestions(prev => prev.map(s => s.category === cat ? { ...s, suggestedLimit: num } : s));
  };

  const handleAccept = () => {
    const enabled = suggestions.filter(s => s.enabled && s.suggestedLimit > 0);
    onAccept(enabled.map(s => ({
      category: s.category,
      monthlyLimit: s.suggestedLimit,
      rollover: false,
    })));
  };

  const enabledCount = suggestions.filter(s => s.enabled).length;
  const totalSuggested = suggestions.filter(s => s.enabled).reduce((s, b) => s + b.suggestedLimit, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="border border-border bg-surface-1 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <p className="ticker mb-1">Auto-Build</p>
            <h2 className="text-lg font-bold tracking-tight">Suggested Budgets</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-10 text-center">
              <p className="ticker text-muted-foreground">Analyzing 3 months of spending...</p>
              <div className="mt-3 h-1 bg-surface-3 overflow-hidden mx-auto w-48">
                <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="ticker text-expense">{error}</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="ticker text-muted-foreground">No spending data found</p>
              <p className="text-sm text-muted-foreground mt-1">Add transactions to generate suggestions</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3 font-mono">
                Based on avg monthly spending (last 3 months). Adjust limits as needed.
              </p>
              {suggestions.map(s => (
                <div
                  key={s.category}
                  className={`border p-3 transition-colors ${s.enabled ? 'border-primary/40 bg-surface-2' : 'border-border bg-surface-1 opacity-50'}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSuggestion(s.category)}
                      className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-colors ${s.enabled ? 'border-primary bg-primary' : 'border-border bg-surface-3'}`}
                    >
                      {s.enabled && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                      )}
                    </button>

                    {/* Category info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CategoryDot category={s.category} size={8} />
                        <span className="text-sm font-medium truncate">{s.category}</span>
                      </div>
                      <p className="ticker text-muted-foreground mt-0.5">
                        avg: {formatCurrency(s.avgSpend)}/mo
                      </p>
                    </div>

                    {/* Editable limit */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-mono">$</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={s.suggestedLimit}
                        onChange={e => updateLimit(s.category, e.target.value)}
                        disabled={!s.enabled}
                        className="w-20 h-7 border border-border bg-surface-2 px-2 text-sm font-mono tabnum text-right text-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal footer */}
        {!loading && suggestions.length > 0 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
            <p className="ticker text-muted-foreground">
              {enabledCount} categories — {formatCurrency(totalSuggested)} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="h-9 px-4 border border-border text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={enabledCount === 0}
                className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
              >
                Apply {enabledCount} Budgets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Budget View ───────────────────────────

export function BudgetView() {
  const { data: budgetData, error, isLoading, refetch } = useFetch<{ budgets: Budget[]; budgetMap: Record<string, number> }>(
    () => budgetsApi.list(), []
  );
  const { data: categories } = useCategories();

  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthRange(now.getFullYear(), now.getMonth());

  // Current month transactions
  const { data: txnData } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 500, dateFrom: monthStart, dateTo: monthEnd }), [monthStart]
  );

  // Previous month transactions (for rollover calc)
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { start: prevStart, end: prevEnd } = monthRange(prevDate.getFullYear(), prevDate.getMonth());
  const { data: prevTxnData } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 500, dateFrom: prevStart, dateTo: prevEnd }), [prevStart]
  );

  const [editCat, setEditCat] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [showAutoBuild, setShowAutoBuild] = useState(false);

  const upsertBudget = useMutation(useCallback((d: any) => budgetsApi.upsert(d), []));
  const deleteBudget = useMutation(useCallback((cat: string) => budgetsApi.delete(cat), []));

  const budgets = budgetData?.budgets || [];
  const transactions = txnData?.transactions || [];
  const prevTransactions = prevTxnData?.transactions || [];

  // Current month spending by category
  const spending: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0) spending[t.category] = (spending[t.category] || 0) + Math.abs(t.amount);
  }

  // Previous month spending by category (for rollover)
  const prevSpending: Record<string, number> = {};
  for (const t of prevTransactions) {
    if (t.amount < 0) prevSpending[t.category] = (prevSpending[t.category] || 0) + Math.abs(t.amount);
  }

  // Calculate rollover amounts per category
  const rolloverAmounts: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = {};
    for (const b of budgets) {
      if (!b.rollover) continue;
      const prevSpent = prevSpending[b.category] || 0;
      // Positive = unspent last month (carry forward), Negative = overspent (reduce this month)
      result[b.category] = b.monthlyLimit - prevSpent;
    }
    return result;
  }, [budgets, prevSpending]);

  // Effective limits (base + rollover)
  const effectiveLimits: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = {};
    for (const b of budgets) {
      const rollover = rolloverAmounts[b.category] || 0;
      result[b.category] = Math.max(0, b.monthlyLimit + rollover);
    }
    return result;
  }, [budgets, rolloverAmounts]);

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const totalBudgeted = budgets.reduce((s, b) => s + (effectiveLimits[b.category] || b.monthlyLimit), 0);
  const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);
  const overallPct = totalBudgeted > 0 ? totalSpent / totalBudgeted : 0;
  const overBudget = totalSpent > totalBudgeted;

  const handleSave = async () => {
    if (!editCat || !editAmount) return;
    await upsertBudget.mutate({ category: editCat, monthlyLimit: parseFloat(editAmount) });
    setEditCat('');
    setEditAmount('');
    refetch();
  };

  const handleDelete = async (cat: string) => {
    await deleteBudget.mutate(cat);
    refetch();
  };

  const handleToggleRollover = async (b: Budget) => {
    await upsertBudget.mutate({ category: b.category, monthlyLimit: b.monthlyLimit, rollover: !b.rollover });
    refetch();
  };

  const handleAutoBuildAccept = async (newBudgets: { category: string; monthlyLimit: number; rollover: boolean }[]) => {
    setShowAutoBuild(false);
    // Bulk upsert via the API
    await upsertBudget.mutate({ budgets: newBudgets });
    refetch();
  };

  if (isLoading) return <PageLoader message="Loading budgets..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Auto-Build Modal */}
      {showAutoBuild && (
        <AutoBuildModal
          onClose={() => setShowAutoBuild(false)}
          onAccept={handleAutoBuildAccept}
          existingBudgets={budgets}
        />
      )}

      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Budget</p>
            <h1 className="text-xl font-bold tracking-tight">
              {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h1>
          </div>
          <div className="text-right">
            <p className="numeral text-2xl font-bold tabnum" style={{ color: overBudget ? 'hsl(var(--expense))' : 'hsl(var(--primary))' }}>
              {(overallPct * 100).toFixed(0)}%
            </p>
            <p className="ticker">{formatCurrency(totalSpent)} of {formatCurrency(totalBudgeted)}</p>
          </div>
        </div>

        {/* Overall bar */}
        <div className="mt-4 h-1.5 bg-surface-3 overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(overallPct * 100, 100)}%`,
              backgroundColor: overBudget ? 'hsl(var(--expense))' : 'hsl(var(--primary))',
              boxShadow: `0 0 8px ${overBudget ? 'hsl(var(--expense) / 0.4)' : 'hsl(var(--primary) / 0.4)'}`,
            }}
          />
        </div>
      </div>

      {/* Add budget row */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="ticker">Set Budget Limit</p>
          <button
            onClick={() => setShowAutoBuild(true)}
            className="h-8 px-3 border border-primary/40 text-primary text-xs font-semibold font-mono hover:bg-primary/10 transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Auto-Build
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[150px]">
            <select
              value={editCat}
              onChange={e => setEditCat(e.target.value)}
              className="h-9 w-full border border-border bg-surface-2 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Select category...</option>
              {expenseCategories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            type="number" step="1" min="1"
            placeholder="Monthly limit"
            value={editAmount}
            onChange={e => setEditAmount(e.target.value)}
            className="w-40 h-9"
          />
          <button
            onClick={handleSave}
            disabled={!editCat || !editAmount}
            className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
          >
            Set Budget
          </button>
        </div>
      </div>

      {/* Budget items */}
      {budgets.length === 0 ? (
        <div className="border border-dashed border-border bg-surface-1 px-5 py-10 text-center">
          <p className="ticker mb-1">No budgets</p>
          <p className="text-sm text-muted-foreground">Set limits above or use Auto-Build to start tracking</p>
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const effective = effectiveLimits[b.category] || b.monthlyLimit;
            const rollover = rolloverAmounts[b.category] || 0;
            const hasRollover = b.rollover && rollover !== 0;
            const spent = spending[b.category] || 0;
            const pct = effective > 0 ? spent / effective : 0;
            const over = pct > 1;

            return (
              <div key={b.id} className="border border-border bg-surface-1 p-4 relative overflow-hidden">
                {over && <div className="absolute top-0 left-0 right-0 h-px bg-expense/60" />}

                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <CategoryDot category={b.category} size={8} />
                    {b.category}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs tabnum">
                      <span className={over ? 'text-expense font-semibold' : 'text-foreground/80'}>{formatCurrency(spent)}</span>
                      <span className="text-muted-foreground"> / {formatCurrency(effective)}</span>
                    </span>

                    {/* Rollover toggle */}
                    <button
                      onClick={() => handleToggleRollover(b)}
                      title={b.rollover ? 'Rollover enabled — click to disable' : 'Enable rollover'}
                      className={`transition-colors ${b.rollover ? 'text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground/60'}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </button>

                    <button onClick={() => handleDelete(b.category)} className="text-muted-foreground/30 hover:text-expense transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                {/* Rollover detail line */}
                {hasRollover && (
                  <p className="font-mono text-[10px] tabnum mb-1.5" style={{ color: rollover > 0 ? 'hsl(var(--primary))' : 'hsl(var(--expense))' }}>
                    {formatCurrency(b.monthlyLimit)} base {rollover > 0 ? '+' : ''} {formatCurrency(rollover)} rollover = {formatCurrency(effective)} effective
                  </p>
                )}

                <div className="h-1.5 bg-surface-3 overflow-hidden relative">
                  {/* Base limit marker when rollover is active */}
                  {hasRollover && rollover > 0 && effective > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-foreground/20 z-10"
                      style={{ left: `${Math.min((b.monthlyLimit / effective) * 100, 100)}%` }}
                    />
                  )}
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(pct * 100, 100)}%`,
                      backgroundColor: over ? 'hsl(var(--expense))' : getCategoryColor(b.category),
                      boxShadow: over ? '0 0 6px hsl(var(--expense) / 0.4)' : undefined,
                    }}
                  />
                </div>

                {over && (
                  <p className="ticker text-expense mt-1.5">{formatCurrency(spent - effective)} over budget</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
