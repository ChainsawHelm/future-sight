'use client';

import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { Transaction } from '@/types/models';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>{p.name || p.dataKey}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

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
    if (t.amount >= 0) continue;
    const m = t.description.toUpperCase().slice(0, 25);
    if (!merchants[m]) merchants[m] = { count: 0, total: 0 };
    merchants[m].count++;
    merchants[m].total += Math.abs(t.amount);
  }
  const topMerchants = Object.entries(merchants)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 8)
    .map(([name, { count, total }]) => ({ name: name.slice(0, 18), total: Math.round(total), count }));

  // Category totals for pie
  const catTotals: Record<string, number> = {};
  for (const t of txns) {
    if (t.amount < 0) catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
  }
  const pieData = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: Math.round(value), fill: getCategoryColor(name) }));

  // Monthly spending trend
  const monthTotals: Record<string, number> = {};
  for (const t of txns) {
    if (t.amount < 0) {
      const m = t.date.slice(0, 7);
      monthTotals[m] = (monthTotals[m] || 0) + Math.abs(t.amount);
    }
  }
  const trendData = Object.entries(monthTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month: month.slice(5), Spending: Math.round(amount) }));

  // Average monthly spending
  const avgMonthly = trendData.length > 0 ? trendData.reduce((s, d) => s + d.Spending, 0) / trendData.length : 0;

  // Largest expenses
  const largestExpenses = txns.filter(t => t.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Patterns and trends in your spending</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold tabnum">{txns.length}</p>
          <p className="text-[11px] text-muted-foreground">Transactions</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold tabnum">{Object.keys(merchants).length}</p>
          <p className="text-[11px] text-muted-foreground">Unique Merchants</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold tabnum">{Object.keys(catTotals).length}</p>
          <p className="text-[11px] text-muted-foreground">Categories</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold tabnum">{formatCurrency(avgMonthly)}</p>
          <p className="text-[11px] text-muted-foreground">Avg Monthly</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants bar chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Top Merchants</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMerchants} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <ReTooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="#EF4444" radius={[0, 4, 4, 0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by category pie */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Spending Breakdown</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2} strokeWidth={0}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <ReTooltip content={<CustomTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly spending trend line */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Monthly Spending Trend</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                <ReTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Spending" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Largest Expenses */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-4">Largest Expenses</h2>
          <div className="space-y-3">
            {largestExpenses.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-600">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-[11px] text-muted-foreground">{t.date} · {t.category}</p>
                </div>
                <span className="text-sm font-semibold tabnum text-red-600">{formatCurrency(Math.abs(t.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
