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
import { isRealIncome, isRealExpense } from '@/lib/classify';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card px-3 py-2 shadow-xl text-xs font-mono">
      {label && <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="tabnum">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

function SectionHeader({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="ticker-label">{label}</p>
      {count && <span className="ticker-label tabnum">{count}</span>}
    </div>
  );
}

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
    if (isRealIncome(t)) monthMap[m].income += t.amount;
    else if (isRealExpense(t)) monthMap[m].expenses += Math.abs(t.amount);
  }
  const barData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, d]) => ({
      month: month.slice(5),
      Income: Math.round(d.income),
      Expenses: Math.round(d.expenses),
    }));

  // ─── Net worth area chart data ────────
  const nwData = (recentNetWorth || []).map((s: any) => ({
    date: s.date.slice(5),
    'Net Worth': Math.round(s.netWorth),
  }));

  const savingsRate = overview.monthlyIncome > 0
    ? ((overview.netSavings / overview.monthlyIncome) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── Page header ─── */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">Financial overview</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          <span className="status-dot online" />
          <span>LIVE</span>
        </div>
      </div>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        <StatCard
          title="Net Worth"
          value={overview.netWorth}
          trend={overview.netWorth >= 0 ? 'up' : 'down'}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 20h20M5 20V10M10 20V4M15 20V12M20 20V8" />
            </svg>
          }
          className="bg-card"
        />
        <StatCard
          title="Monthly Income"
          value={overview.monthlyIncome}
          trend="up"
          subtitle="This month"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v20m5-16l-5-5-5 5" />
            </svg>
          }
          className="bg-card"
        />
        <StatCard
          title="Monthly Spending"
          value={overview.monthlyExpenses}
          trend="down"
          subtitle="This month"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22V2m-5 16l5 5 5-5" />
            </svg>
          }
          className="bg-card"
        />
        <StatCard
          title="Net Savings"
          value={overview.netSavings}
          trend={overview.netSavings >= 0 ? 'up' : 'down'}
          subtitle={`${savingsRate}% savings rate`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 5L5 19M5 5l14 14" />
            </svg>
          }
          className="bg-card"
        />
      </div>

      {/* ─── Assets / Liabilities quick strip ─── */}
      <div className="grid grid-cols-3 gap-px bg-border text-center">
        <div className="bg-card px-3 py-2.5">
          <p className="ticker-label mb-1">Total Assets</p>
          <p className="mono-num text-sm font-semibold text-income tabnum">{formatCurrency(overview.totalAssets)}</p>
        </div>
        <div className="bg-card px-3 py-2.5">
          <p className="ticker-label mb-1">Total Liabilities</p>
          <p className="mono-num text-sm font-semibold text-expense tabnum">{formatCurrency(overview.totalDebts)}</p>
        </div>
        <div className="bg-card px-3 py-2.5">
          <p className="ticker-label mb-1">Transactions</p>
          <p className="mono-num text-sm font-semibold tabnum">{overview.totalTransactions.toLocaleString()}</p>
        </div>
      </div>

      {/* ─── Charts row 1 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
        {/* Spending breakdown donut */}
        <div className="bg-card p-4">
          <SectionHeader label="Spending by Category" count={`${pieData.length} cats`} />
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">No spending data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-[150px] h-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <ReTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="text-muted-foreground truncate">{d.name}</span>
                    </span>
                    <span className="tabnum mono-num font-medium ml-2 shrink-0 text-foreground">
                      {totalSpend > 0 ? Math.round((d.value / totalSpend) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monthly income vs expenses */}
        <div className="bg-card p-4">
          <SectionHeader label="Income vs Expenses" count={`${barData.length}mo`} />
          {barData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">No data yet</p>
          ) : (
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={2} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40} />
                  <ReTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Legend iconSize={6} wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                  <Bar dataKey="Income" fill="hsl(var(--income))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Expenses" fill="hsl(var(--expense))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ─── Charts row 2 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
        {/* Net worth trend */}
        <div className="bg-card p-4">
          <SectionHeader label="Net Worth Trend" count={`${nwData.length} snapshots`} />
          {nwData.length < 2 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">Take snapshots to see trends</p>
          ) : (
            <div className="h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nwData}>
                  <defs>
                    <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40} />
                  <ReTooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 2' }} />
                  <Area type="monotone" dataKey="Net Worth" stroke="hsl(var(--primary))" fill="url(#nwGrad)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Goals progress */}
        <div className="bg-card p-4">
          <SectionHeader label="Savings Goals" count={`${goals.length} active`} />
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">No active goals</p>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 5).map((goal: any) => (
                <div key={goal.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{goal.name}</span>
                    <span className="mono-num text-[10px] text-muted-foreground tabnum shrink-0">
                      {formatCurrency(goal.currentAmount)} <span className="text-border">/</span> {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="h-1 bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.min(goal.progress * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mono-num text-[9px] text-muted-foreground mt-0.5 tabnum text-right">
                    {(goal.progress * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Debts table ─── */}
      {debts.length > 0 && (
        <div className="bg-card border border-border p-4">
          <SectionHeader label="Active Debts" count={`${debts.length} accounts`} />
          <div className="space-y-0 divide-y divide-border">
            {debts.map((debt: any) => (
              <div key={debt.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1 h-6 bg-expense shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{debt.name}</p>
                    <p className="mono-num text-[10px] text-muted-foreground tabnum">{(debt.progress * 100).toFixed(0)}% paid</p>
                  </div>
                </div>
                <span className="mono-num text-sm font-semibold text-expense tabnum shrink-0">{formatCurrency(debt.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overview.totalTransactions === 0 && (
        <EmptyState
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>}
          title="No transactions yet"
          description="Import a CSV or PDF bank statement to get started with your financial overview."
        />
      )}
    </div>
  );
}
