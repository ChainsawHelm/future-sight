'use client';

import { useState, useMemo } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { SankeyChart } from './sankey-chart';
import { cn } from '@/lib/utils';
import {
  type Period, PERIOD_OPTIONS, getPeriodLabel, getPeriodRange,
  filterByPeriod, getTransactionYears,
} from '@/lib/periods';

export function MoneyFlowView() {
  const [period, setPeriod] = useState<Period>('ytd');
  const { data, isLoading } = useFetch(
    () => transactionsApi.list({ limit: 5000, sort: 'date', order: 'desc' }), []
  );

  const allTxns = data?.transactions || [];
  const periodTxns = useMemo(() => filterByPeriod(allTxns, period), [allTxns, period]);
  const txnYears = useMemo(() => getTransactionYears(allTxns), [allTxns]);

  const range = getPeriodRange(period);
  const label = getPeriodLabel(period);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Analytics</p>
        <h1 className="text-xl font-bold tracking-tight">Money Flow</h1>
      </div>

      {/* Period selector */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-2 p-1 flex-wrap">
          {PERIOD_OPTIONS.map(p => (
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
              {getPeriodLabel(p)}
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
