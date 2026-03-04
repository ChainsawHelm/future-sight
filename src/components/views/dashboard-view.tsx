'use client';

import { useDashboard } from '@/hooks/use-data';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { DashboardSkeleton } from '@/components/shared/skeletons';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency } from '@/lib/utils';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export function DashboardView() {
  const { data, error, isLoading, refetch } = useDashboard();
  const { data: txnData } = useFetch(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'asc' }), []
  );

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (!data) return null;

  const { overview, categorySpending, goals, debts, recentNetWorth } = data;
  const txns = txnData?.transactions || [];

  // ─── Pie chart data ───────────────────
  const pieData = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value, fill: getCategoryColor(name) }));
  const totalSpend = pieData.reduce((s, d) => s + d.value, 0);

  // ─── Monthly bar chart data ───────────
  const monthMap: Record<string, { income: number; expenses: number }> = {};
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { income: 0, expenses: 0 };
    if (t.amount > 0) monthMap[m].income += t.amount;
    else monthMap[m].expenses += Math.abs(t.amount);
  }
  const barData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, d]) => ({
      month: month.slice(5), // MM only
      Income: Math.round(d.income),
      Expenses: Math.round(d.expenses),
    }));

  // ─── Net worth area chart data ────────
  const nwData = (recentNetWorth || []).map((s: any) => ({
    date: s.date.slice(5),
    'Net Worth': Math.round(s.netWorth),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your financial overview at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Net Worth" value={overview.netWorth} trend={overview.netWorth >= 0 ? 'up' : 'down'}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 20h20M5 20V10M10 20V4M15 20V12M20 20V8" /></svg>} />
        <StatCard title="Monthly Income" value={overview.monthlyIncome} trend="up" subtitle="This month"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20m5-16l-5-5-5 5" /></svg>} />
        <StatCard title="Monthly Spending" value={overview.monthlyExpenses} trend="down" subtitle="This month"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22V2m-5 16l5 5 5-5" /></svg>} />
        <StatCard title="Net Savings" value={overview.netSavings} trend={overview.netSavings >= 0 ? 'up' : 'down'} subtitle={overview.netSavings >= 0 ? "You're saving!" : 'Overspent'}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 5L5 19M5 5l14 14" /></svg>} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending donut */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-2">Spending by Category</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No spending data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[180px] h-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <ReTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      {d.name}
                    </span>
                    <span className="tabnum font-medium ml-2 shrink-0">{totalSpend > 0 ? Math.round((d.value / totalSpend) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly income vs expenses bar chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-2">Monthly Income vs Expenses</h2>
          {barData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No data yet</p>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} className="text-muted-foreground" />
                  <ReTooltip content={<CustomTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Income" fill="#16A34A" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#EF4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Net worth trend + goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net worth trend */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-2">Net Worth Trend</h2>
          {nwData.length < 2 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Take snapshots to see trends</p>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nwData}>
                  <defs>
                    <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <ReTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Net Worth" stroke="#1E3A5F" fill="url(#nwGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Goals progress */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-4">Savings Goals</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No active goals</p>
          ) : (
            <div className="space-y-4">
              {goals.map((goal: any) => (
                <div key={goal.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{goal.name}</span>
                    <span className="text-xs text-muted-foreground tabnum">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-savings transition-all duration-500" style={{ width: `${Math.min(goal.progress * 100, 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 tabnum">{(goal.progress * 100).toFixed(1)}% complete</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Debts + Assets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Debts</h2>
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active debts</p>
          ) : (
            <div className="space-y-3">
              {debts.map((debt: any) => (
                <div key={debt.name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{debt.name}</p>
                    <p className="text-xs text-muted-foreground tabnum">{(debt.progress * 100).toFixed(0)}% paid off</p>
                  </div>
                  <span className="text-sm font-semibold tabnum text-red-600 dark:text-red-400">{formatCurrency(debt.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Asset Summary</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabnum">{formatCurrency(overview.totalAssets)}</span>
            <span className="text-xs text-muted-foreground">total assets</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-semibold tabnum text-red-600 dark:text-red-400">{formatCurrency(overview.totalDebts)}</span>
            <span className="text-xs text-muted-foreground">total liabilities</span>
          </div>
        </div>
      </div>

      {overview.totalTransactions === 0 && (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>}
          title="No transactions yet"
          description="Import a CSV or PDF bank statement to get started with your financial overview."
        />
      )}
    </div>
  );
}
