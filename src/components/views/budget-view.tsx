'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useCategories } from '@/hooks/use-data';
import { budgetsApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import type { Budget, Transaction } from '@/types/models';

export function BudgetView() {
  const { data: budgetData, error, isLoading, refetch } = useFetch<{ budgets: Budget[]; budgetMap: Record<string, number> }>(
    () => budgetsApi.list(), []
  );
  const { data: categories } = useCategories();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const { data: txnData } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 200, dateFrom: monthStart, dateTo: monthEnd }), [monthStart]
  );

  const [editCat, setEditCat] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const upsertBudget = useMutation(useCallback((d: any) => budgetsApi.upsert(d), []));
  const deleteBudget = useMutation(useCallback((cat: string) => budgetsApi.delete(cat), []));

  const budgets = budgetData?.budgets || [];
  const transactions = txnData?.transactions || [];

  const spending: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0) spending[t.category] = (spending[t.category] || 0) + Math.abs(t.amount);
  }

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const totalBudgeted = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
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

  if (isLoading) return <PageLoader message="Loading budgets..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-4 animate-fade-in">
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
        <p className="ticker mb-3">Set Budget Limit</p>
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
          <p className="text-sm text-muted-foreground">Set limits above to start tracking</p>
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const spent = spending[b.category] || 0;
            const pct = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
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
                      <span className="text-muted-foreground"> / {formatCurrency(b.monthlyLimit)}</span>
                    </span>
                    <button onClick={() => handleDelete(b.category)} className="text-muted-foreground/30 hover:text-expense transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                <div className="h-1.5 bg-surface-3 overflow-hidden">
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
                  <p className="ticker text-expense mt-1.5">{formatCurrency(spent - b.monthlyLimit)} over budget</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
