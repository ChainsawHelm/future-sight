'use client';

import { useState, useMemo } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { SankeyChart } from './sankey-chart';
import { cn } from '@/lib/utils';

type Period = 'month' | 'last_month' | '3months' | 'ytd' | 'all' | `year:${number}`;

const PERIOD_LABELS: Record<string, string> = {
  month: 'This Month',
  last_month: 'Last Month',
  '3months': '3 Months',
  ytd: 'Year to Date',
  all: 'All Time',
};

function getPeriodRange(period: Period): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (period === 'month') return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
  if (period === 'last_month') return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
  if (period === '3months') return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) };
  if (period === 'ytd') return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
  if (period.startsWith('year:')) {
    const yr = parseInt(period.slice(5));
    return { from: `${yr}-01-01`, to: `${yr}-12-31` };
  }
  return null;
}

function filterByPeriod<T extends { date: string }>(txns: T[], period: Period): T[] {
  const range = getPeriodRange(period);
  if (!range) return txns;
  return txns.filter(t => t.date >= range.from && t.date <= range.to);
}

export function MoneyFlowView() {
  const [period, setPeriod] = useState<Period>('all');
  const { data, isLoading } = useFetch(
    () => transactionsApi.list({ limit: 5000, sort: 'date', order: 'desc' }), []
  );

  const allTxns = data?.transactions || [];
  const periodTxns = useMemo(() => filterByPeriod(allTxns, period), [allTxns, period]);

  const txnYears = useMemo(() => {
    const years = new Set<number>();
    for (const t of allTxns) {
      const yr = parseInt(t.date.slice(0, 4));
      if (!isNaN(yr)) years.add(yr);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allTxns]);

  const range = getPeriodRange(period);
  const label = period.startsWith('year:') ? period.slice(5) : PERIOD_LABELS[period] || period;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Analytics</p>
        <h1 className="text-xl font-bold tracking-tight">Money Flow</h1>
      </div>

      {/* Period selector */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-2 p-1 flex-wrap">
          {(['month', 'last_month', '3months', 'ytd', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                period === p
                  ? 'bg-card text-primary shadow-soft border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {txnYears.length > 0 && (
          <div className="flex items-center gap-1 bg-surface-2 p-1">
            {txnYears.map(yr => (
              <button
                key={yr}
                onClick={() => setPeriod(`year:${yr}`)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-mono font-semibold transition-all duration-150',
                  period === `year:${yr}`
                    ? 'bg-card text-primary shadow-soft border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sankey */}
      <div className="border border-border bg-card shadow-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Money Flow</h3>
            <span className="text-[10px] text-muted-foreground font-mono bg-surface-2 px-2 py-0.5">
              {label} · {periodTxns.length} transactions
            </span>
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading transactions...</div>
        ) : (
          <SankeyChart
            transactions={periodTxns}
            period={period}
            dateFrom={range?.from}
            dateTo={range?.to}
            tall
          />
        )}
      </div>
    </div>
  );
}
