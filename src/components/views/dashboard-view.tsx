'use client';

import { useState, useMemo } from 'react';
import { useDashboard } from '@/hooks/use-data';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { DashboardSkeleton } from '@/components/shared/skeletons';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency } from '@/lib/utils';
import { isRealIncome, isRealExpense } from '@/lib/classify';
import { SankeyChart } from './sankey-chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
  LabelList,
  AreaChart, Area,
} from 'recharts';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════
   PERIOD HELPERS
══════════════════════════════════════════ */
type Period = 'month' | 'last_month' | '3months' | 'ytd' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  month:      'This Month',
  last_month: 'Last Month',
  '3months':  '3 Months',
  ytd:        'Year to Date',
  all:        'All Time',
};

function getPeriodRange(period: Period): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (period === 'month') {
    return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
  }
  if (period === 'last_month') {
    return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
  }
  if (period === '3months') {
    return { from: fmt(new Date(y, m - 2, 1)), to: fmt(new Date(y, m + 1, 0)) };
  }
  if (period === 'ytd') {
    return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
  }
  return null; // all time
}

function filterByPeriod<T extends { date: string }>(txns: T[], period: Period): T[] {
  const range = getPeriodRange(period);
  if (!range) return txns;
  return txns.filter(t => t.date >= range.from && t.date <= range.to);
}

/* ══════════════════════════════════════════
   CHART TOOLTIP
══════════════════════════════════════════ */
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card px-3 py-2 shadow-medium">
      {label && <p className="text-xs font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="tabnum text-xs" style={{ color: p.color || p.fill }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════
   GOAL RING
══════════════════════════════════════════ */
const RING_COLORS = ['#7C3AED', '#059669', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899'];

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
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="tabnum text-[13px] font-bold">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-foreground/70 font-semibold leading-tight truncate max-w-[76px]">{name}</p>
        <p className="tabnum text-[9px] text-muted-foreground mt-0.5">{formatCurrency(currentAmount)}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ACTIVITY ITEM
══════════════════════════════════════════ */
function ActivityItem({ t, index }: { t: any; index: number }) {
  const isCredit = t.amount > 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 animate-fade-in" style={{ animationDelay: `${index * 25}ms` }}>
      <div className={cn(
        'w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold',
        isCredit ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
      )}>
        {isCredit ? '+' : '−'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{t.description}</p>
        <p className="tabnum text-[10px] text-muted-foreground mt-px">
          {t.date} · {t.category}
        </p>
      </div>
      <span className={cn('tabnum text-sm font-bold shrink-0', isCredit ? 'text-income' : 'text-expense')}>
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
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {meta && <span className="text-[10px] text-muted-foreground font-mono bg-surface-2 px-2 py-0.5">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

/* ══════════════════════════════════════════
   HEALTH GAUGE
══════════════════════════════════════════ */
function HealthGauge({ label, value, suffix, target, invert, description, status, benchmark, positiveFlow }: {
  label: string; value: number | null; suffix: string; target: number; invert?: boolean;
  description: string; status: 'good' | 'warn' | 'bad'; benchmark: string; positiveFlow?: boolean;
}) {
  const colors = { good: 'text-income', warn: 'text-yellow-400', bad: 'text-expense' };
  const bgColors = { good: 'bg-income', warn: 'bg-yellow-400', bad: 'bg-expense' };
  const icons = { good: '●', warn: '◐', bad: '○' };

  // For the fill bar
  let fillPct = 0;
  if (positiveFlow) {
    fillPct = 100;
  } else if (value !== null && target > 0) {
    fillPct = invert
      ? Math.max(0, Math.min(100, ((target - value) / target) * 100))
      : Math.min(100, (value / target) * 100);
  }

  const displayValue = value === null
    ? '∞'
    : positiveFlow
      ? 'Positive'
      : value.toFixed(1);

  return (
    <div className="space-y-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={cn('text-[10px]', colors[status])}>{icons[status]}</span>
      </div>
      <p className={cn('numeral text-2xl font-bold tabnum', colors[status])}>
        {displayValue}{!positiveFlow && value !== null ? suffix : ''}
      </p>
      <div className="h-1.5 bg-surface-2 overflow-hidden">
        <div
          className={cn('h-full transition-all duration-700', bgColors[status])}
          style={{ width: `${fillPct}%`, opacity: 0.7 }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground font-mono leading-snug">{description}</p>
      <p className="text-[9px] text-muted-foreground/60 font-mono">{benchmark}</p>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN VIEW
══════════════════════════════════════════ */
export function DashboardView() {
  const { data, error, isLoading, refetch } = useDashboard();
  const { data: txnData } = useFetch(
    () => transactionsApi.list({ limit: 500, sort: 'date', order: 'desc' }), []
  );
  const [period, setPeriod] = useState<Period>('month');

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (!data) return null;

  const { overview, goals, debts, recentNetWorth, healthMetrics, wealthMetrics, flexibilityMetrics } = data as any;
  const allTxns = txnData?.transactions || [];

  // Period-filtered transactions (for Sankey, charts, and period stats)
  const periodTxns = filterByPeriod(allTxns, period);

  // Period-specific metrics
  const periodIncome   = periodTxns.filter(isRealIncome).reduce((s, t) => s + t.amount, 0);
  const periodExpenses = periodTxns.filter(isRealExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
  const periodNet      = periodIncome - periodExpenses;
  const periodSavings  = periodIncome > 0 ? (periodNet / periodIncome) * 100 : 0;

  // Category spending for current period
  const catSpend: Record<string, number> = {};
  for (const t of periodTxns) {
    if (isRealExpense(t)) catSpend[t.category] = (catSpend[t.category] || 0) + Math.abs(t.amount);
  }
  const pieData = Object.entries(catSpend)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: Math.round(value), fill: getCategoryColor(name) }));
  const totalSpend = pieData.reduce((s, d) => s + d.value, 0);

  // Monthly bar data (always from all time, last 6 months)
  const monthMap: Record<string, { income: number; expenses: number }> = {};
  for (const t of allTxns) {
    const m = t.date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { income: 0, expenses: 0 };
    if (isRealIncome(t)) monthMap[m].income += t.amount;
    else if (isRealExpense(t)) monthMap[m].expenses += Math.abs(t.amount);
  }
  const barData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([m, d]) => ({ month: m.slice(5), Income: Math.round(d.income), Expenses: Math.round(d.expenses) }));

  // Net worth trend
  const nwData = (recentNetWorth || []).map((s: any) => ({ date: s.date.slice(5), 'Net Worth': Math.round(s.netWorth) }));
  const maxNW = Math.max(...nwData.map((d: any) => d['Net Worth']), 1);
  const sparkPoints = nwData.length >= 2
    ? nwData.map((d: any, i: number) => `${(i / (nwData.length - 1)) * 200},${40 - ((d['Net Worth'] / maxNW) * 34)}`).join(' ')
    : null;

  const savingsRate   = overview.monthlyIncome > 0 ? (overview.netSavings / overview.monthlyIncome) * 100 : 0;
  const debtToIncome  = overview.monthlyIncome > 0 ? (overview.totalDebts / (overview.monthlyIncome * 12)) * 100 : 0;
  const recentTxns    = allTxns.slice(0, 8);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ════════════ PERIOD TABS ════════════ */}
      <div className="flex items-center gap-1 bg-surface-2 p-1 w-fit flex-wrap">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
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

      {/* ════════════ PERIOD METRIC STRIP ════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `${PERIOD_LABELS[period]} Income`, value: formatCurrency(periodIncome), color: 'text-income' },
          { label: `${PERIOD_LABELS[period]} Spending`, value: formatCurrency(periodExpenses), color: 'text-expense' },
          { label: 'Net', value: formatCurrency(periodNet), color: periodNet >= 0 ? 'text-income' : 'text-expense' },
          { label: 'Savings Rate', value: `${Math.max(0, periodSavings).toFixed(1)}%`, color: periodSavings >= 10 ? 'text-income' : 'text-muted-foreground' },
        ].map((m) => (
          <div key={m.label} className="border border-border bg-card p-4 shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{m.label}</p>
            <p className={cn('numeral text-xl font-bold tabnum', m.color)}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ════════════ SANKEY — CENTERPIECE ════════════ */}
      <div className="border border-border bg-card shadow-soft p-5">
        <SectionHeader
          label="Money Flow"
          meta={`${PERIOD_LABELS[period]} · ${periodTxns.length} transactions`}
        />
        <SankeyChart transactions={periodTxns} period={period} />
      </div>

      {/* ════════════ NET WORTH STRIP ════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Net Worth',
            value: formatCurrency(Math.abs(overview.netWorth)),
            prefix: overview.netWorth < 0 ? '−' : '',
            color: overview.netWorth >= 0 ? 'text-income' : 'text-expense',
          },
          { label: 'Total Assets',       value: formatCurrency(overview.totalAssets), color: 'text-income' },
          { label: 'Total Liabilities',  value: formatCurrency(overview.totalDebts),  color: 'text-expense' },
          {
            label: 'Monthly Δ',
            value: formatCurrency(Math.abs(overview.netSavings)),
            prefix: overview.netSavings >= 0 ? '▲ ' : '▼ ',
            color: overview.netSavings >= 0 ? 'text-income' : 'text-expense',
          },
        ].map((m) => (
          <div key={m.label} className="border border-border bg-card p-4 shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{m.label}</p>
            <p className={cn('numeral text-xl font-bold tabnum', m.color)}>
              {'prefix' in m ? m.prefix : ''}{m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ════════════ FINANCIAL HEALTH GAUGES ════════════ */}
      {healthMetrics && (
        <div className="border border-border bg-card p-5 shadow-soft">
          <SectionHeader label="Financial Health" meta="Key ratios" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Emergency Fund */}
            <HealthGauge
              label="Emergency Fund"
              value={healthMetrics.emergencyFundMonths}
              suffix=" mo"
              target={6}
              description={`${formatCurrency(healthMetrics.liquidAssets)} liquid`}
              status={healthMetrics.emergencyFundMonths >= 6 ? 'good' : healthMetrics.emergencyFundMonths >= 3 ? 'warn' : 'bad'}
              benchmark="Target: 3–6 months"
            />
            {/* Debt-to-Income */}
            <HealthGauge
              label="Debt-to-Income"
              value={healthMetrics.dti}
              suffix="%"
              target={36}
              invert
              description={`${formatCurrency(healthMetrics.totalMinPayments)}/mo payments`}
              status={healthMetrics.dti <= 20 ? 'good' : healthMetrics.dti <= 36 ? 'warn' : 'bad'}
              benchmark="Target: < 36%"
            />
            {/* Housing Ratio */}
            <HealthGauge
              label="Housing Cost"
              value={healthMetrics.housingRatio}
              suffix="%"
              target={28}
              invert
              description={`${formatCurrency(healthMetrics.housingCost)}/mo`}
              status={healthMetrics.housingRatio <= 28 ? 'good' : healthMetrics.housingRatio <= 35 ? 'warn' : 'bad'}
              benchmark="Target: < 28%"
            />
            {/* Cash Flow Runway */}
            <HealthGauge
              label="Cash Flow"
              value={flexibilityMetrics.cashFlowRunwayMonths === -1 ? null : flexibilityMetrics.cashFlowRunwayMonths}
              suffix={flexibilityMetrics.netMonthlyCashFlow >= 0 ? '' : ' mo left'}
              target={0}
              description={`${flexibilityMetrics.netMonthlyCashFlow >= 0 ? '+' : ''}${formatCurrency(flexibilityMetrics.netMonthlyCashFlow)}/mo net`}
              status={flexibilityMetrics.netMonthlyCashFlow >= 0 ? 'good' : flexibilityMetrics.cashFlowRunwayMonths > 6 ? 'warn' : 'bad'}
              benchmark={flexibilityMetrics.netMonthlyCashFlow >= 0 ? 'Positive cash flow' : 'Spending > Income'}
              positiveFlow={flexibilityMetrics.netMonthlyCashFlow >= 0}
            />
          </div>
        </div>
      )}

      {/* ════════════ CATEGORY BARS + INCOME VS EXPENSES ════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category spending bars */}
        <div className="border border-border bg-card p-5 shadow-soft">
          <SectionHeader
            label="Spending by Category"
            meta={totalSpend > 0 ? formatCurrency(totalSpend) : undefined}
          />
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No spending in this period</p>
          ) : (
            <div className="space-y-3">
              {pieData.map((d, i) => {
                const pct = totalSpend > 0 ? (d.value / totalSpend) * 100 : 0;
                return (
                  <div key={d.name} className="animate-fade-in" style={{ animationDelay: `${i * 35}ms` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-xs text-foreground/80 font-medium">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabnum text-[10px] font-mono text-muted-foreground">{pct.toFixed(1)}%</span>
                        <span className="tabnum text-xs font-semibold w-20 text-right">{formatCurrency(d.value)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-surface-2 overflow-hidden">
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: d.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly bar chart (always all-time last 6 months) */}
        <div className="border border-border bg-card p-5 shadow-soft">
          <SectionHeader label="Income vs Expenses" meta="Last 6 months" />
          {barData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No data yet</p>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={38} />
                  <ReTooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--foreground) / 0.03)', radius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} iconType="circle" />
                  <Bar dataKey="Income" fill="hsl(var(--income))" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Income" position="top" formatter={(v: number) => v > 0 ? `$${(v/1000).toFixed(1)}k` : ''} style={{ fontSize: 9, fill: 'hsl(var(--income))', fontFamily: 'var(--font-mono)' }} />
                  </Bar>
                  <Bar dataKey="Expenses" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Expenses" position="top" formatter={(v: number) => v > 0 ? `$${(v/1000).toFixed(1)}k` : ''} style={{ fontSize: 9, fill: 'hsl(var(--expense))', fontFamily: 'var(--font-mono)' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ════════════ ACTIVITY FEED + GOAL RINGS ════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="border border-border bg-card p-5 shadow-soft">
          <SectionHeader label="Recent Activity" meta={`${recentTxns.length} transactions`} />
          {recentTxns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No transactions yet</p>
          ) : (
            <div>{recentTxns.map((t, i) => <ActivityItem key={t.id} t={t} index={i} />)}</div>
          )}
        </div>

        <div className="border border-border bg-card p-5 shadow-soft">
          <SectionHeader label="Savings Goals" meta={`${goals.length} active`} />
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No active goals</p>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center pt-2">
              {goals.slice(0, 6).map((goal: any, i: number) => (
                <GoalRing key={goal.name} name={goal.name} progress={goal.progress} currentAmount={goal.currentAmount} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════════ NET WORTH TREND ════════════ */}
      <div className="border border-border bg-card p-5 shadow-soft">
        <SectionHeader label="Net Worth Trend" meta={`${nwData.length} snapshots`} />
        {nwData.length < 2 ? (
          <div className="flex items-center justify-center py-10 border border-dashed border-border">
            <p className="text-xs text-muted-foreground text-center">Take snapshots on the Net Worth page to see your trend</p>
          </div>
        ) : (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={nwData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={42} />
                <ReTooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="Net Worth" stroke="hsl(var(--primary))" fill="url(#nwGrad)" strokeWidth={2} dot={false}
                  activeDot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ════════════ DEBTS ════════════ */}
      {debts.length > 0 && (
        <div className="border border-border bg-card p-5 shadow-soft">
          <SectionHeader label="Debt Tracker" meta={`${debts.length} accounts`} />
          <div className="space-y-4">
            {debts.map((debt: any, i: number) => {
              const pct = Math.min(debt.progress * 100, 100);
              return (
                <div key={debt.name} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-expense shrink-0" />
                      <span className="text-sm font-medium">{debt.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabnum text-[10px] font-mono text-muted-foreground">{pct.toFixed(0)}% paid</span>
                      <span className="tabnum text-sm font-bold text-expense">{formatCurrency(debt.balance)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-2 overflow-hidden">
                    <div className="h-full bg-expense transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {overview.totalTransactions === 0 && (
        <div className="border border-primary/20 bg-surface-1 p-6 space-y-5 animate-fade-in">
          <div>
            <p className="text-lg font-bold text-primary tracking-tight">Welcome to Future Sight</p>
            <p className="ticker mt-1">Get your financial command center up and running in a few steps.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <a href="/import" className="group border border-border bg-surface-2 p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">Import Transactions</p>
              </div>
              <p className="ticker">Upload a CSV or PDF bank statement to load your spending history.</p>
            </a>
            <a href="/budget" className="group border border-border bg-surface-2 p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">Set Budgets</p>
              </div>
              <p className="ticker">Create spending limits per category, or auto-build from your history.</p>
            </a>
            <a href="/goals" className="group border border-border bg-surface-2 p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">Track Goals</p>
              </div>
              <p className="ticker">Set savings goals and track your progress toward financial targets.</p>
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            TIP: Connect your bank via Accounts for automatic transaction syncing.
          </p>
        </div>
      )}
    </div>
  );
}
