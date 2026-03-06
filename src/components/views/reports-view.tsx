'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryDot } from '@/components/shared/category-badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/types/models';

export function ReportsView() {
  const { data, error, isLoading, refetch } = useFetch(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'desc' }), []
  );
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const txns: Transaction[] = data?.transactions || [];

  if (isLoading) return <PageLoader message="Generating report..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (txns.length === 0) return <EmptyState title="No data" description="Import transactions to generate reports." />;

  // Group by period
  const groups: Record<string, Transaction[]> = {};
  for (const t of txns) {
    const key = period === 'month' ? t.date.slice(0, 7) : t.date.slice(0, 4);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const sortedPeriods = Object.keys(groups).sort().reverse();

  const exportCSV = () => {
    const rows = ['Date,Description,Amount,Category,Account'];
    for (const t of txns) rows.push(`${t.date},"${t.description}",${t.amount},${t.category},${t.account}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `future-sight-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Summary by {period}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border overflow-hidden">
            {(['month', 'year'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-navy-500 text-white' : 'hover:bg-muted'}`}>
                {p === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      <div className="space-y-4">
        {sortedPeriods.map(p => {
          const periodTxns = groups[p];
          const income = periodTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
          const expenses = periodTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
          const net = income - expenses;

          const catBreakdown: Record<string, number> = {};
          for (const t of periodTxns) {
            if (t.amount < 0) catBreakdown[t.category] = (catBreakdown[t.category] || 0) + Math.abs(t.amount);
          }
          const topCats = Object.entries(catBreakdown).sort(([, a], [, b]) => b - a).slice(0, 5);

          return (
            <div key={p} className="border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{p}</h2>
                <span className="text-xs text-muted-foreground">{periodTxns.length} transactions</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><p className="text-[11px] text-muted-foreground">Income</p><p className="text-lg font-bold tabnum text-green-600">+{formatCurrency(income)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">Expenses</p><p className="text-lg font-bold tabnum text-red-600">-{formatCurrency(expenses)}</p></div>
                <div><p className="text-[11px] text-muted-foreground">Net</p><p className={`text-lg font-bold tabnum ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(net)}</p></div>
              </div>
              {topCats.length > 0 && (
                <div className="border-t pt-3 space-y-1.5">
                  {topCats.map(([cat, amt]) => (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5"><CategoryDot category={cat} size={6} />{cat}</span>
                      <span className="tabnum">{formatCurrency(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
