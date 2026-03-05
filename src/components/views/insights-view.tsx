'use client';

import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency } from '@/lib/utils';
import { isRealExpense } from '@/lib/classify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { Transaction } from '@/types/models';

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-surface-2 px-3 py-2 shadow-lg text-xs font-mono">
      {label && <p className="text-muted-foreground mb-1 uppercase tracking-wider text-[10px]">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-semibold" style={{ color: p.color || p.fill }}>
          {p.name || p.dataKey}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const AXIS_STYLE = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'hsl(var(--muted-foreground))' };

export function InsightsView() {
  const { data, error, isLoading, refetch } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'desc' }), []
  );

  const txns = data?.transactions || [];

  if (isLoading) return <PageLoader message="Analyzing spending..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (txns.length === 0) return <EmptyState title="No data yet" description="Import transactions to see insights." />;

  // Top merchants
  const merchants: Record<string, { count: number; total: number }> = {};
  for (const t of txns) {
    if (!isRealExpense(t)) continue;
    const m = t.description.toUpperCase().slice(0, 25);
    if (!merchants[m]) merchants[m] = { count: 0, total: 0 };
    merchants[m].count++;
    merchants[m].total += Math.abs(t.amount);
  }
  const topMerchants = Object.entries(merchants)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 8)
    .map(([name, { count, total }]) => ({ name: name.slice(0, 18), total: Math.round(total), count }));

  // Category totals for breakdown
  const catTotals: Record<string, number> = {};
  for (const t of txns) {
    if (isRealExpense(t)) catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
  }
  const pieData = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: Math.round(value), fill: getCategoryColor(name) }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // Monthly spending trend
  const monthTotals: Record<string, number> = {};
  for (const t of txns) {
    if (isRealExpense(t)) {
      const m = t.date.slice(0, 7);
      monthTotals[m] = (monthTotals[m] || 0) + Math.abs(t.amount);
    }
  }
  const trendData = Object.entries(monthTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month: month.slice(5), Spending: Math.round(amount) }));

  const avgMonthly = trendData.length > 0 ? trendData.reduce((s, d) => s + d.Spending, 0) / trendData.length : 0;
  const largestExpenses = txns.filter(isRealExpense).sort((a, b) => a.amount - b.amount).slice(0, 5);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Analytics</p>
        <h1 className="text-xl font-bold tracking-tight">Insights</h1>
      </div>

      {/* Quick stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface-1">
        {[
          { label: 'Transactions', value: txns.length.toLocaleString() },
          { label: 'Unique Merchants', value: Object.keys(merchants).length.toLocaleString() },
          { label: 'Categories', value: Object.keys(catTotals).length.toLocaleString() },
          { label: 'Avg Monthly', value: formatCurrency(avgMonthly) },
        ].map((stat, i) => (
          <div key={stat.label} className={`px-4 py-3 ${i > 0 ? 'border-l border-border' : ''}`}>
            <p className="ticker mb-1">{stat.label}</p>
            <p className="numeral font-bold text-lg tabnum">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Merchants */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-4">Top Merchants</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMerchants} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={AXIS_STYLE} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS_STYLE} width={110} axisLine={false} tickLine={false} />
                <ReTooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--surface-3))' }} />
                <Bar dataKey="total" fill="hsl(var(--expense))" radius={0} name="Spent"
                  style={{ filter: 'drop-shadow(0 0 4px hsl(var(--expense) / 0.3))' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending Breakdown — horizontal bars instead of pie */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-4">Spending Breakdown</p>
          <div className="space-y-3">
            {pieData.map((d) => {
              const pct = pieTotal > 0 ? (d.value / pieTotal) * 100 : 0;
              return (
                <div key={d.name}>
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <CategoryDot category={d.name} />
                      <span className="text-xs font-mono text-foreground/80">{d.name}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{pct.toFixed(1)}%</span>
                      <span className="font-mono text-xs font-semibold tabnum">{formatCurrency(d.value)}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-surface-3 overflow-hidden">
                    <div
                      style={{
                        width: `${pct}%`,
                        backgroundColor: d.fill,
                        boxShadow: `0 0 6px ${d.fill}60`,
                        height: '100%',
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Spending Trend */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-4">Monthly Spending Trend</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
                <ReTooltip content={<ChartTip />} cursor={{ stroke: 'hsl(var(--border))' }} />
                <Line
                  type="monotone" dataKey="Spending"
                  stroke="hsl(var(--expense))" strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--expense))', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--expense))', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Largest Expenses */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-4">Largest Expenses</p>
          <div className="space-y-0 divide-y divide-border">
            {largestExpenses.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 h-6 flex items-center justify-center bg-expense/10 text-expense font-mono text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.description}</p>
                  <p className="ticker">{t.date} · {t.category}</p>
                </div>
                <span className="font-mono text-sm font-bold tabnum text-expense shrink-0">
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
