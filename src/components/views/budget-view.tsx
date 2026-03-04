'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useCategories } from '@/hooks/use-data';
import { budgetsApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import type { Budget, Transaction } from '@/types/models';

export function BudgetView() {
  const { data: budgetData, error, isLoading, refetch } = useFetch<{ budgets: Budget[]; budgetMap: Record<string, number> }>(
    () => budgetsApi.list(), []
  );
  const { data: categories } = useCategories();

  // Get this month's transactions for spending comparison
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
  const budgetMap = budgetData?.budgetMap || {};
  const transactions = txnData?.transactions || [];

  // Calculate spending per category
  const spending: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0) {
      spending[t.category] = (spending[t.category] || 0) + Math.abs(t.amount);
    }
  }

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];

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

  const totalBudgeted = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = Object.values(spending).reduce((s, v) => s + v, 0);

  if (isLoading) return <PageLoader message="Loading budgets..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Budget</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatCurrency(totalSpent)} spent of {formatCurrency(totalBudgeted)} budgeted this month
        </p>
      </div>

      {/* Overall bar */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Monthly Budget Usage</span>
          <span className="tabnum">{totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(0) : 0}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${totalSpent > totalBudgeted ? 'bg-red-500' : 'bg-navy-500'}`}
            style={{ width: `${Math.min((totalSpent / (totalBudgeted || 1)) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Add/edit budget inline */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[150px]">
          <select value={editCat} onChange={e => setEditCat(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
            <option value="">Select category...</option>
            {expenseCategories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <Input type="number" step="1" min="1" placeholder="Monthly limit" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-40 h-10" />
        <Button onClick={handleSave} disabled={!editCat || !editAmount} className="bg-navy-500 hover:bg-navy-600">Set Budget</Button>
      </div>

      {/* Budget items */}
      <div className="space-y-3">
        {budgets.map((b) => {
          const spent = spending[b.category] || 0;
          const pct = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;
          const over = pct > 1;

          return (
            <div key={b.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CategoryDot category={b.category} size={10} />
                  {b.category}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabnum">
                    <span className={over ? 'text-red-600 font-semibold' : ''}>{formatCurrency(spent)}</span>
                    <span className="text-muted-foreground"> / {formatCurrency(b.monthlyLimit)}</span>
                  </span>
                  <button onClick={() => handleDelete(b.category)} className="text-muted-foreground/30 hover:text-red-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : ''}`}
                  style={{
                    width: `${Math.min(pct * 100, 100)}%`,
                    backgroundColor: over ? undefined : getCategoryColor(b.category),
                  }}
                />
              </div>
              {over && <p className="text-[11px] text-red-500 mt-1 tabnum">{formatCurrency(spent - b.monthlyLimit)} over budget</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
