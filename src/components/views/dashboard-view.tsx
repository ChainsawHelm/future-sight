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
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from 'recharts';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════
   SHARED CHART TOOLTIP
══════════════════════════════════════════ */
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-surface-1 px-3 py-2 shadow-xl">
      {label && <p className="ticker mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="tabnum text-[11px] font-medium" style={{ color: p.color || p.fill }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════
   GOAL RING — circular SVG progress
══════════════════════════════════════════ */
const RING_COLORS = ['#00E574', '#338EFF', '#FFB400', '#FF6B35', '#A855F7'];

function GoalRing({ name, progress, currentAmount, index }: {
  name: string; progress: number; currentAmount: number; index: number;
}) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(progress, 1));
  const color = RING_COLORS[index % RING_COLORS.length];
  const pct = Math.round(Math.min(progress, 1) * 100);

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="relative w-[72px] h-[72px]">
        <svg viewBox="0 0 72 72" className="w-full h-full">
          {/* Track */}
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            stroke="hsl(var(--surface-3))"
            strokeWidth="5"
          />
          {/* Progress */}
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 0.8s ease-out', filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="tabnum text-[13px] font-bold">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-foreground/70 font-medium leading-tight truncate max-w-[76px]">{name}</p>
        <p className="tabnum text-[9px] text-muted-foreground mt-0.5">{formatCurrency(currentAmount)}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ACTIVITY FEED ITEM — new module
══════════════════════════════════════════ */
function ActivityItem({ t, index }: { t: any; index: number }) {
  const isCredit = t.amount > 0;
  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 animate-fade-in"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Type indicator */}
      <div className={cn(
        'w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold font-mono rounded-sm',
        isCredit ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
      )}>
        {isCredit ? '+' : '−'}
      </div>

      {/* Description + date/category */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate leading-tight">{t.description}</p>
        <p className="tabnum text-[10px] text-muted-foreground mt-px">
          {t.date} <span className="text-border mx-1">·</span> {t.category}
        </p>
      </div>

      {/* Amount */}
      <span className={cn(
        'tabnum text-sm font-bold shrink-0',
        isCredit ? 'text-income' : 'text-expense'
      )}>
        {isCredit ? '+' : '−'}{formatCurrency(Math.abs(t.amount))}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════
   SECTION HEADER
══════════════════════════════════════════ */
function SectionHeader({ label, meta, action }: { label: string; meta?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <p className="ticker">{label}</p>
        {meta && <span className="tabnum text-[10px] text-border font-mono">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN VIEW
══════════════════════════════════════════ */
export function DashboardView() {
  const { data, error, isLoading, refetch } = useDashboard();
  const { data: txnData } = useFetch(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'desc' }), []
  );

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (!data) return null;

  const { overview, categorySpending, goals, debts, recentNetWorth } = data;
  const txns = txnData?.transactions || [];

  // ── Category pie data
  const pieData = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: Math.round(value), fill: getCategoryColor(name) }));
  const totalSpend = pieData.reduce((s, d) => s + d.value, 0);

  // ── Monthly bar/area data
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
    .map(([m, d]) => ({
      month: m.slice(5),
      Income: Math.round(d.income),
      Expenses: Math.round(d.expenses),
    }));

  // ── Net worth chart data
  const nwData = (recentNetWorth || []).map((s: any) => ({
    date: s.date.slice(5),
    'Net Worth': Math.round(s.netWorth),
  }));
  const maxNW = Math.max(...nwData.map((d: any) => d['Net Worth']), 1);

  // ── Inline sparkline points for hero
  const sparkPoints = nwData.length >= 2
    ? nwData.map((d: any, i: number) => {
        const x = (i / (nwData.length - 1)) * 200;
        const y = 40 - ((d['Net Worth'] / maxNW) * 34);
        return `${x},${y}`;
      }).join(' ')
    : null;

  // ── Savings metrics
  const savingsRate = overview.monthlyIncome > 0
    ? (overview.netSavings / overview.monthlyIncome) * 100
    : 0;
  const debtToIncome = overview.monthlyIncome > 0
    ? (overview.totalDebts / (overview.monthlyIncome * 12)) * 100
    : 0;

  // ── Recent transactions
  const recentTxns = txns.slice(0, 10);

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ════════════════════════════════════
          COMMAND HEADER — Net Worth Hero
      ════════════════════════════════════ */}
      <div className="relative overflow-hidden border border-border bg-surface-1" style={{ background: 'linear-gradient(135deg, hsl(var(--surface-1)) 0%, hsl(222, 30%, 9%) 100%)' }}>
        {/* Subtle grid lines in background */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Embedded sparkline ghost */}
        {sparkPoints && (
          <div className="absolute bottom-0 right-0 w-[220px] h-[50px] opacity-20 pointer-events-none">
            <svg viewBox="0 0 200 40" className="w-full h-full" preserveAspectRatio="none">
              <polyline
                points={sparkPoints}
                fill="none"
                stroke="hsl(var(--income))"
                strokeWidth="1.5"
              />
              {/* Fill below line */}
              <polygon
                points={`0,40 ${sparkPoints} 200,40`}
                fill="url(#spark-grad)"
              />
              <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--income))" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="hsl(var(--income))" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}

        <div className="relative z-10 p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          {/* Left: Net Worth */}
          <div>
            <div className="status-live mb-3">Live</div>
            <p className="ticker mb-2">Total Net Worth</p>
            <p className={cn(
              'numeral font-bold leading-none tabnum',
              'text-4xl sm:text-5xl',
              overview.netWorth >= 0 ? 'text-foreground' : 'text-expense'
            )}>
              {overview.netWorth < 0 ? '−' : ''}{formatCurrency(Math.abs(overview.netWorth))}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
              <span className={cn(
                'tabnum text-xs font-semibold font-mono flex items-center gap-1',
                overview.netSavings >= 0 ? 'text-income' : 'text-expense'
              )}>
                {overview.netSavings >= 0 ? '▲' : '▼'}
                {formatCurrency(Math.abs(overview.netSavings))} this month
              </span>
              {savingsRate !== 0 && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {savingsRate.toFixed(1)}% savings rate
                </span>
              )}
            </div>
          </div>

          {/* Right: Assets vs Liabilities */}
          <div className="flex items-center gap-5">
            <div>
              <p className="ticker mb-1">Assets</p>
              <p className="numeral text-xl font-bold text-income tabnum">{formatCurrency(overview.totalAssets)}</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="ticker mb-1">Liabilities</p>
              <p className="numeral text-xl font-bold text-expense tabnum">{formatCurrency(overview.totalDebts)}</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="ticker mb-1">Transactions</p>
              <p className="numeral text-xl font-bold tabnum">{overview.totalTransactions.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          QUICK METRIC STRIP — new module
      ════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface-1 stagger">
        {[
          { label: 'Monthly Income', value: formatCurrency(overview.monthlyIncome), color: 'text-income' },
          { label: 'Monthly Spend', value: formatCurrency(overview.monthlyExpenses), color: 'text-expense' },
          { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 0 ? 'text-income' : 'text-expense' },
          { label: 'Debt / Yr Income', value: `${debtToIncome.toFixed(0)}%`, color: debtToIncome < 36 ? 'text-income' : 'text-expense' },
        ].map((m, i) => (
          <div key={m.label} className={cn('px-4 py-3 flex flex-col gap-1 animate-fade-in', i > 0 && 'border-l border-border')}>
            <p className="ticker">{m.label}</p>
            <p className={cn('numeral text-lg font-bold tabnum', m.color)}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════
          STAT CARDS
      ════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard index={0} title="Net Worth" value={overview.netWorth} trend={overview.netWorth >= 0 ? 'up' : 'down'} />
        <StatCard index={1} title="Monthly Income" value={overview.monthlyIncome} trend="up" subtitle="This month" />
        <StatCard index={2} title="Monthly Spending" value={overview.monthlyExpenses} trend="down" subtitle="This month" />
        <StatCard index={3} title="Net Savings" value={overview.netSavings} trend={overview.netSavings >= 0 ? 'up' : 'down'} subtitle={overview.netSavings >= 0 ? "You're saving!" : 'Overspent'} />
      </div>

      {/* ════════════════════════════════════
          ROW: Category Spending + Monthly Chart
      ════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Category Horizontal Bars — replaces pie chart entirely */}
        <div className="border border-border bg-surface-1 p-4">
          <SectionHeader label="Spending by Category" meta={totalSpend > 0 ? formatCurrency(totalSpend) + ' total' : undefined} />
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center font-mono">No spending data</p>
          ) : (
            <div className="space-y-2.5 mt-1">
              {pieData.map((d, i) => {
                const pct = totalSpend > 0 ? (d.value / totalSpend) * 100 : 0;
                return (
                  <div key={d.name} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-[11px] text-foreground/70 font-medium">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabnum text-[11px] font-mono text-muted-foreground">{pct.toFixed(1)}%</span>
                        <span className="tabnum text-[11px] font-mono font-semibold text-foreground w-20 text-right">{formatCurrency(d.value)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-3 overflow-hidden rounded-sm">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: d.fill,
                          boxShadow: `0 0 6px ${d.fill}50`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly Income vs Expenses */}
        <div className="border border-border bg-surface-1 p-4">
          <SectionHeader label="Income vs Expenses" meta={`${barData.length} months`} />
          {barData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center font-mono">No data yet</p>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={3} barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false} width={38}
                  />
                  <ReTooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--foreground) / 0.03)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    iconSize={8} iconType="circle"
                  />
                  <Bar dataKey="Income" fill="hsl(var(--income))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Expenses" fill="hsl(var(--expense))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════
          ROW: Activity Feed + Goal Rings
      ════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">

        {/* Activity Feed — new module */}
        <div className="border border-border bg-surface-1 p-4">
          <SectionHeader
            label="Recent Activity"
            meta={`${recentTxns.length} transactions`}
          />
          {recentTxns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center font-mono">No transactions</p>
          ) : (
            <div>
              {recentTxns.map((t, i) => (
                <ActivityItem key={t.id} t={t} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Goal Rings — new module */}
        <div className="border border-border bg-surface-1 p-4">
          <SectionHeader label="Savings Goals" meta={`${goals.length} active`} />
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center font-mono">No active goals</p>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center pt-2">
              {goals.slice(0, 6).map((goal: any, i: number) => (
                <GoalRing
                  key={goal.name}
                  name={goal.name}
                  progress={goal.progress}
                  currentAmount={goal.currentAmount}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════
          NET WORTH TREND
      ════════════════════════════════════ */}
      <div className="border border-border bg-surface-1 p-4">
        <SectionHeader label="Net Worth Trend" meta={`${nwData.length} snapshots`} />
        {nwData.length < 2 ? (
          <div className="flex items-center justify-center py-10 border border-dashed border-border rounded-sm">
            <p className="text-xs text-muted-foreground font-mono text-center">
              Take snapshots on the Net Worth page to see your trend
            </p>
          </div>
        ) : (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={nwData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--income))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--income))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
                <ReTooltip content={<ChartTip />} cursor={{ stroke: 'hsl(var(--income))', strokeWidth: 1, strokeDasharray: '4 2' }} />
                <Area
                  type="monotone" dataKey="Net Worth"
                  stroke="hsl(var(--income))" fill="url(#nwGrad)" strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--income))', strokeWidth: 0, filter: 'drop-shadow(0 0 4px hsl(var(--income)))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════
          DEBTS — if any exist
      ════════════════════════════════════ */}
      {debts.length > 0 && (
        <div className="border border-border bg-surface-1 p-4">
          <SectionHeader label="Debt Tracker" meta={`${debts.length} accounts`} />
          <div className="space-y-3">
            {debts.map((debt: any, i: number) => {
              const pct = Math.min(debt.progress * 100, 100);
              return (
                <div key={debt.name} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-5 bg-expense rounded-full shrink-0" />
                      <span className="text-xs font-medium">{debt.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabnum text-[10px] font-mono text-muted-foreground">{pct.toFixed(0)}% paid</span>
                      <span className="tabnum text-sm font-bold text-expense">{formatCurrency(debt.balance)}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-surface-3 overflow-hidden">
                    <div
                      className="h-full bg-expense transition-all duration-700"
                      style={{ width: `${pct}%`, boxShadow: '0 0 6px hsl(var(--expense) / 0.5)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {overview.totalTransactions === 0 && (
        <EmptyState
          title="No transactions yet"
          description="Import a CSV or PDF bank statement to get started with your financial overview."
        />
      )}
    </div>
  );
}
