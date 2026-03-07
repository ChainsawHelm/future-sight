'use client';

import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi, budgetsApi, subscriptionsApi, dashboardApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency, cn } from '@/lib/utils';
import { ChartTip, AXIS_STYLE } from '@/components/shared/chart-helpers';
import { isRealExpense, isRealIncome } from '@/lib/classify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { Transaction, DashboardData } from '@/types/models';

// ─── BLS Consumer Expenditure Survey 2022 — % of after-tax income ──────────
const BENCHMARKS: { label: string; blsPct: number; categories: string[] }[] = [
  { label: 'Housing',        blsPct: 33, categories: ['Rent', 'Mortgage', 'Housing', 'Utilities', 'Home'] },
  { label: 'Food',           blsPct: 13, categories: ['Groceries', 'Dining', 'Fast Food', 'Food', 'Coffee', 'Restaurants'] },
  { label: 'Transportation', blsPct: 17, categories: ['Gas', 'Auto', 'Transportation', 'Parking', 'Uber', 'Lyft', 'Transit'] },
  { label: 'Healthcare',     blsPct: 8,  categories: ['Medical', 'Healthcare', 'Pharmacy', 'Dental', 'Vision', 'Health'] },
  { label: 'Entertainment',  blsPct: 5,  categories: ['Entertainment', 'Streaming', 'Movies', 'Games', 'Music', 'Subscriptions'] },
  { label: 'Shopping',       blsPct: 3,  categories: ['Shopping', 'Clothing', 'Amazon', 'Retail'] },
  { label: 'Education',      blsPct: 2,  categories: ['Education', 'Tuition', 'Books', 'Student Loans'] },
  { label: 'Personal Care',  blsPct: 1,  categories: ['Personal Care', 'Haircut', 'Beauty', 'Gym', 'Fitness'] },
];


function AlertCard({ type, title, body }: { type: 'warn' | 'good' | 'info'; title: string; body: string }) {
  const colors = {
    warn: 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400',
    good: 'border-green-500/40 bg-green-500/5 text-green-400',
    info: 'border-blue-500/40 bg-blue-500/5 text-blue-400',
  };
  const icons = {
    warn: '⚠',
    good: '✓',
    info: '↑',
  };
  return (
    <div className={cn('border px-4 py-3 flex gap-3 items-start', colors[type])}>
      <span className="text-sm mt-0.5 shrink-0">{icons[type]}</span>
      <div>
        <p className="text-xs font-semibold font-mono">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
      </div>
    </div>
  );
}

export function InsightsView() {
  const { data: txData, error: txError, isLoading: txLoading, refetch } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 5000, sort: 'date', order: 'desc' }), []
  );
  const { data: budgetData } = useFetch<any>(() => budgetsApi.list(), []);
  const { data: subData } = useFetch<any>(() => subscriptionsApi.list(), []);
  const { data: dashData } = useFetch<DashboardData>(() => dashboardApi.get(), []);

  if (txLoading) return <PageLoader message="Analyzing your finances..." />;
  if (txError) return <ErrorAlert message={txError} retry={refetch} />;

  const txns = txData?.transactions || [];
  if (txns.length === 0) return <EmptyState title="No data yet" description="Import transactions to see personalized insights." />;

  const budgets: { category: string; monthlyLimit: number }[] = budgetData?.budgets || [];
  const subscriptions: { amount: number; frequency: string; isActive: boolean }[] = subData?.subscriptions || [];

  // ─── Date helpers ────────────────────────────────────────────────────────
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed
  const curMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const monthFraction = dayOfMonth / daysInMonth;

  // ─── Bucket transactions by YYYY-MM ─────────────────────────────────────
  const byMonth: Record<string, Transaction[]> = {};
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(t);
  }

  // Last 6 complete months (excluding current)
  const past6Months: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(curYear, curMonth - i, 1);
    past6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const curTxns = byMonth[curMonthStr] || [];

  // ─── Savings rate ────────────────────────────────────────────────────────
  const curIncome = curTxns.filter(isRealIncome).reduce((s, t) => s + t.amount, 0);
  const curExpenses = curTxns.filter(isRealExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
  const curSavings = curIncome - curExpenses;
  const curSavingsRate = curIncome > 0 ? (curSavings / curIncome) * 100 : 0;

  const monthlyTrend = [...past6Months].reverse().map(m => {
    const mTxns = byMonth[m] || [];
    const inc = mTxns.filter(isRealIncome).reduce((s, t) => s + t.amount, 0);
    const exp = mTxns.filter(isRealExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
    const rate = inc > 0 ? ((inc - exp) / inc) * 100 : 0;
    return { month: m.slice(5), Income: Math.round(inc), Expenses: Math.round(exp), Rate: Math.round(rate) };
  });

  const avgMonthlyIncome = past6Months.reduce((s, m) => {
    return s + (byMonth[m] || []).filter(isRealIncome).reduce((ss, t) => ss + t.amount, 0);
  }, 0) / 6;

  const avgMonthlyExpenses = past6Months.reduce((s, m) => {
    return s + (byMonth[m] || []).filter(isRealExpense).reduce((ss, t) => ss + Math.abs(t.amount), 0);
  }, 0) / 6;

  // ─── Category vs personal average ───────────────────────────────────────
  const catAvg: Record<string, number> = {};
  for (const m of past6Months) {
    for (const t of byMonth[m] || []) {
      if (!isRealExpense(t)) continue;
      catAvg[t.category] = (catAvg[t.category] || 0) + Math.abs(t.amount);
    }
  }
  // Average per month
  for (const c of Object.keys(catAvg)) catAvg[c] /= 6;

  const catCurrent: Record<string, number> = {};
  for (const t of curTxns) {
    if (!isRealExpense(t)) continue;
    catCurrent[t.category] = (catCurrent[t.category] || 0) + Math.abs(t.amount);
  }

  // Categories where current month is significantly above or below average
  const allCategories = [...new Set([...Object.keys(catAvg), ...Object.keys(catCurrent)])];
  const catComparisons = allCategories
    .map(cat => {
      const avg = catAvg[cat] || 0;
      const cur = catCurrent[cat] || 0;
      // Project current month to full month based on day
      const projected = monthFraction > 0 ? cur / monthFraction : cur;
      const delta = avg > 0 ? ((projected - avg) / avg) * 100 : 0;
      return { cat, avg, cur, projected, delta };
    })
    .filter(d => d.avg > 20 || d.cur > 20) // skip tiny categories
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // ─── Budget alerts ───────────────────────────────────────────────────────
  const budgetAlerts: { category: string; spent: number; limit: number; pct: number }[] = [];
  for (const b of budgets) {
    const spent = catCurrent[b.category] || 0;
    const pct = (spent / b.monthlyLimit) * 100;
    if (pct >= 80) budgetAlerts.push({ category: b.category, spent, limit: b.monthlyLimit, pct });
  }

  // ─── Unusual transactions (last 30 days vs 90-day merchant avg) ──────────
  const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const ninetyAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  const merchantHistory: Record<string, number[]> = {};
  for (const t of txns) {
    if (!isRealExpense(t) || t.date < ninetyAgo) continue;
    const key = t.description.slice(0, 30).toUpperCase().trim();
    if (!merchantHistory[key]) merchantHistory[key] = [];
    merchantHistory[key].push(Math.abs(t.amount));
  }

  const unusualTxns = txns
    .filter(t => isRealExpense(t) && t.date >= thirtyAgo)
    .filter(t => {
      const key = t.description.slice(0, 30).toUpperCase().trim();
      const hist = merchantHistory[key] || [];
      if (hist.length < 2) return false;
      const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
      return Math.abs(t.amount) > avg * 2.2 && Math.abs(t.amount) - avg > 30;
    })
    .map(t => {
      const key = t.description.slice(0, 30).toUpperCase().trim();
      const hist = merchantHistory[key] || [];
      const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
      return { t, avg };
    })
    .sort((a, b) => Math.abs(b.t.amount) - Math.abs(a.t.amount))
    .slice(0, 4);

  // ─── Subscription creep ───────────────────────────────────────────────────
  const activeSubs = subscriptions.filter(s => s.isActive);
  const subMonthly = activeSubs.reduce((s, sub) => {
    const m = sub.frequency === 'yearly' ? sub.amount / 12
            : sub.frequency === 'weekly'  ? sub.amount * 4.33
            : sub.amount;
    return s + m;
  }, 0);

  // ─── National benchmarks ─────────────────────────────────────────────────
  const totalIncome = past6Months.reduce((s, m) => {
    return s + (byMonth[m] || []).filter(isRealIncome).reduce((ss, t) => ss + t.amount, 0);
  }, 0);
  const monthlyIncomeForBenchmark = totalIncome / 6 || curIncome || 1;

  const benchmarkData = BENCHMARKS.map(b => {
    const yourSpend = past6Months.reduce((s, m) => {
      return s + (byMonth[m] || []).filter(t => isRealExpense(t) && b.categories.some(c =>
        t.category.toLowerCase().includes(c.toLowerCase())
      )).reduce((ss, t) => ss + Math.abs(t.amount), 0);
    }, 0) / 6;
    const yourPct = monthlyIncomeForBenchmark > 0 ? (yourSpend / monthlyIncomeForBenchmark) * 100 : 0;
    return { ...b, yourSpend, yourPct };
  }).filter(b => b.yourPct > 0 || b.blsPct >= 8);

  // ─── Top merchants ───────────────────────────────────────────────────────
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

  // ─── Largest single expenses ─────────────────────────────────────────────
  const largestExpenses = txns.filter(isRealExpense).sort((a, b) => a.amount - b.amount).slice(0, 5);

  // ─── Build alerts list ───────────────────────────────────────────────────
  const alerts: { type: 'warn' | 'good' | 'info'; title: string; body: string }[] = [];

  if (curSavingsRate >= 20) {
    alerts.push({ type: 'good', title: `Savings rate: ${curSavingsRate.toFixed(1)}%`, body: 'You are meeting the 20% savings benchmark. Keep it up.' });
  } else if (curIncome > 0) {
    const need = curIncome * 0.20 - curSavings;
    alerts.push({ type: 'warn', title: `Savings rate: ${curSavingsRate.toFixed(1)}% — below 20% target`, body: `You would need to cut ${formatCurrency(need)} more this month to hit the 20% benchmark.` });
  }

  for (const a of budgetAlerts) {
    const msg = a.pct >= 100
      ? `You have exceeded your ${formatCurrency(a.limit)} ${a.category} budget by ${formatCurrency(a.spent - a.limit)}.`
      : `You have used ${a.pct.toFixed(0)}% of your ${a.category} budget with ${daysRemaining} days left. Pace: ${formatCurrency(a.spent / dayOfMonth * daysInMonth)} projected.`;
    alerts.push({ type: a.pct >= 100 ? 'warn' : 'info', title: `${a.category} budget at ${a.pct.toFixed(0)}%`, body: msg });
  }

  if (subMonthly > 0 && avgMonthlyExpenses > 0) {
    const subPct = (subMonthly / avgMonthlyExpenses) * 100;
    if (subPct > 15) {
      alerts.push({ type: 'warn', title: `Subscriptions are ${subPct.toFixed(0)}% of your monthly expenses`, body: `You have ${activeSubs.length} active subscriptions totalling ${formatCurrency(subMonthly)}/mo. Review for services you no longer use.` });
    }
  }

  for (const { t, avg } of unusualTxns.slice(0, 2)) {
    alerts.push({ type: 'info', title: `Unusual charge: ${t.description.slice(0, 30)}`, body: `${formatCurrency(Math.abs(t.amount))} on ${t.date} — your typical spend here is ${formatCurrency(avg)}.` });
  }

  // ─── Budget adherence (last 6 complete months) ────────────────────────────
  const adherenceMonths = [...past6Months].reverse(); // oldest → newest

  interface MonthCell { month: string; spent: number; pct: number; }
  interface CatAdherence {
    category: string; limit: number;
    monthly: MonthCell[];
    overCount: number; avgPct: number;
    trend: 'improving' | 'worsening' | 'stable';
    tip: string;
  }

  const budgetAdherenceData: CatAdherence[] = budgets.map(b => {
    const monthly: MonthCell[] = adherenceMonths.map(m => {
      const spent = (byMonth[m] || [])
        .filter(t => isRealExpense(t) && t.category === b.category)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { month: m.slice(5), spent, pct: b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0 };
    });
    const dataMonths = monthly.filter(m => m.spent > 0);
    if (dataMonths.length === 0) return null;

    const overCount = monthly.filter(m => m.pct > 100).length;
    const avgPct = monthly.reduce((s, m) => s + m.pct, 0) / monthly.length;
    const first3 = monthly.slice(0, 3).reduce((s, m) => s + m.pct, 0) / 3;
    const last3  = monthly.slice(3).reduce((s, m) => s + m.pct, 0) / 3;
    const trend: 'improving' | 'worsening' | 'stable' =
      last3 < first3 - 10 ? 'improving' : last3 > first3 + 10 ? 'worsening' : 'stable';

    const avgSpend = dataMonths.reduce((s, m) => s + m.spent, 0) / dataMonths.length;
    let tip = '';
    if (overCount >= 4) {
      const suggested = Math.ceil(avgSpend / 10) * 10;
      tip = `Exceeded ${overCount} of 6 months. Average spend is ${formatCurrency(avgSpend)}. Raise limit to ${formatCurrency(suggested)} or actively cut back.`;
    } else if (trend === 'worsening' && overCount >= 2) {
      const inc = ((last3 - first3) / Math.max(first3, 1) * 100).toFixed(0);
      tip = `Spending trending up ${inc}% over the last 3 months. Address this before it becomes a consistent habit.`;
    } else if (trend === 'improving' && overCount >= 1) {
      tip = `Spending has been declining — down from recent highs. Keep the momentum.`;
    } else if (overCount === 2) {
      tip = `Two overages in 6 months. Monitor this — a pattern may be forming.`;
    } else if (overCount === 1) {
      tip = `One overage in 6 months. Likely a one-time event. Keep an eye on it.`;
    }

    return { category: b.category, limit: b.monthlyLimit, monthly, overCount, avgPct, trend, tip };
  }).filter(Boolean) as CatAdherence[];

  const monthlyAdherenceScore = adherenceMonths.map((_, i) => {
    const withData  = budgetAdherenceData.filter(d => d.monthly[i].spent > 0);
    const onBudget  = withData.filter(d => d.monthly[i].pct <= 100);
    return withData.length > 0 ? Math.round((onBudget.length / withData.length) * 100) : null;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Analytics</p>
        <h1 className="text-xl font-bold tracking-tight">Insights</h1>
      </div>

      {/* Key metrics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface-1 divide-x divide-border">
        {[
          { label: 'Savings Rate', value: `${curSavingsRate.toFixed(1)}%`, sub: curSavingsRate >= 20 ? '≥ 20% target' : '< 20% target', ok: curSavingsRate >= 20 },
          { label: 'Avg Monthly Income', value: formatCurrency(avgMonthlyIncome), sub: '6-month avg', ok: null },
          { label: 'Avg Monthly Spend', value: formatCurrency(avgMonthlyExpenses), sub: '6-month avg', ok: null },
          { label: 'Subscriptions', value: formatCurrency(subMonthly), sub: `${activeSubs.length} active / mo`, ok: null },
        ].map(stat => (
          <div key={stat.label} className="px-4 py-3">
            <p className="ticker mb-1">{stat.label}</p>
            <p className={cn('numeral font-bold text-lg tabnum', stat.ok === true && 'text-income', stat.ok === false && 'text-expense')}>{stat.value}</p>
            <p className="ticker text-[10px]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="ticker px-1">Action Items</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.map((a, i) => (
              <AlertCard key={i} type={a.type} title={a.title} body={a.body} />
            ))}
          </div>
        </div>
      )}

      {/* Budget adherence heatmap */}
      {budgetAdherenceData.length > 0 && (
        <div className="border border-border bg-surface-1 p-4">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
            <p className="ticker">Budget Adherence — Last 6 Months</p>
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-income/40 inline-block" />On budget</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-yellow-500/40 inline-block" />Near limit</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-expense/40 inline-block" />Over</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mb-4">Complete months only. Current month excluded.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left ticker py-1.5 pr-4 min-w-[130px]">Category</th>
                  {adherenceMonths.map(m => (
                    <th key={m} className="ticker py-1.5 px-2 text-center min-w-[52px]">{m.slice(5)}</th>
                  ))}
                  <th className="ticker py-1.5 px-2 text-center min-w-[44px]">Avg</th>
                  <th className="ticker py-1.5 px-3 text-left">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {budgetAdherenceData.map(d => (
                  <tr key={d.category}>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        <CategoryDot category={d.category} />
                        <span className="text-foreground/80 text-[11px]">{d.category}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 ml-4">{formatCurrency(d.limit)}/mo</p>
                    </td>
                    {d.monthly.map((m, i) => {
                      const bg = m.spent === 0 ? '' : m.pct <= 80 ? 'bg-income/10 text-income' : m.pct <= 100 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-expense/10 text-expense';
                      return (
                        <td key={i} className="py-2 px-2 text-center">
                          {m.spent === 0
                            ? <span className="text-[10px] text-muted-foreground/30">—</span>
                            : <span className={cn('text-[10px] font-semibold px-1 py-0.5 inline-block', bg)}>{m.pct.toFixed(0)}%</span>
                          }
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center">
                      <span className={cn('text-[10px] font-semibold', d.avgPct <= 80 ? 'text-income' : d.avgPct <= 100 ? 'text-yellow-400' : 'text-expense')}>
                        {d.avgPct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn('text-[10px]', d.trend === 'improving' ? 'text-income' : d.trend === 'worsening' ? 'text-expense' : 'text-muted-foreground')}>
                        {d.trend === 'improving' ? '↓ improving' : d.trend === 'worsening' ? '↑ worsening' : '→ stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="py-2 pr-4 ticker text-[10px]">Monthly score</td>
                  {monthlyAdherenceScore.map((score, i) => (
                    <td key={i} className="py-2 px-2 text-center">
                      {score === null
                        ? <span className="text-[10px] text-muted-foreground/30">—</span>
                        : <span className={cn('text-[10px] font-semibold font-mono', score >= 80 ? 'text-income' : score >= 60 ? 'text-yellow-400' : 'text-expense')}>{score}%</span>
                      }
                    </td>
                  ))}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Improvement tips */}
          {budgetAdherenceData.some(d => d.tip) && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <p className="ticker text-[10px] mb-2">Improvement Analysis</p>
              {budgetAdherenceData.filter(d => d.tip).map(d => (
                <div key={d.category} className={cn(
                  'flex gap-3 px-3 py-2.5 border text-xs',
                  d.trend === 'improving' ? 'border-income/30 bg-income/5'
                  : d.overCount >= 4       ? 'border-expense/30 bg-expense/5'
                  :                          'border-yellow-500/30 bg-yellow-500/5'
                )}>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <CategoryDot category={d.category} />
                    <span className="font-semibold">{d.category}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{d.tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {budgets.length === 0 && (
        <div className="border border-border bg-surface-1 px-5 py-4 flex items-center gap-3 text-sm text-muted-foreground font-mono">
          <span className="text-muted-foreground/40">▸</span>
          Set budgets in the Budget tab to see month-over-month adherence tracking here.
        </div>
      )}

      {/* Spending trend */}
      <div className="border border-border bg-surface-1 p-4">
        <p className="ticker mb-4">Income vs Expenses — Last 6 Months</p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_STYLE} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <ReTooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--surface-3))' }} />
              <Bar dataKey="Income" fill="hsl(var(--income))" radius={0} name="Income" />
              <Bar dataKey="Expenses" fill="hsl(var(--expense))" radius={0} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Your spend vs your average */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-1">This Month vs Your 6-Month Average</p>
          <p className="text-[10px] text-muted-foreground font-mono mb-4">Projected to month-end based on current pace</p>
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {catComparisons.slice(0, 12).map(({ cat, avg, projected, delta }) => {
              const isOver = delta > 0;
              const color = delta > 20 ? 'text-expense' : delta < -10 ? 'text-income' : 'text-muted-foreground';
              return (
                <div key={cat}>
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <CategoryDot category={cat} />
                      <span className="text-xs font-mono text-foreground/80">{cat}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[10px] text-muted-foreground">avg {formatCurrency(avg)}</span>
                      <span className={cn('font-mono text-[10px] font-semibold', color)}>
                        {isOver ? '+' : ''}{delta.toFixed(0)}%
                      </span>
                      <span className="font-mono text-xs font-semibold tabnum">{formatCurrency(projected)}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-surface-3 overflow-hidden relative">
                    {/* avg baseline */}
                    <div className="absolute inset-0" style={{ width: `${Math.min((avg / Math.max(avg, projected)) * 100, 100)}%`, backgroundColor: 'hsl(var(--border))', height: '100%' }} />
                    {/* projected */}
                    <div style={{
                      width: `${Math.min((projected / Math.max(avg, projected)) * 100, 100)}%`,
                      backgroundColor: delta > 20 ? 'hsl(var(--expense))' : delta < -10 ? 'hsl(var(--income))' : getCategoryColor(cat),
                      height: '100%',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* National benchmarks */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-1">Your Spend vs National Average</p>
          <p className="text-[10px] text-muted-foreground font-mono mb-4">Source: BLS Consumer Expenditure Survey 2022</p>
          <div className="space-y-3">
            {benchmarkData.map(b => {
              const yourPct = Math.round(b.yourPct);
              const over = yourPct > b.blsPct;
              const maxPct = Math.max(yourPct, b.blsPct, 1);
              return (
                <div key={b.label}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs font-mono text-foreground/80">{b.label}</span>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[10px] text-muted-foreground">US avg {b.blsPct}%</span>
                      <span className={cn('font-mono text-xs font-semibold tabnum', over && yourPct - b.blsPct > 5 ? 'text-expense' : over ? '' : 'text-income')}>
                        You {yourPct}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {/* National avg bar */}
                    <div className="h-1 bg-surface-3 overflow-hidden">
                      <div style={{ width: `${(b.blsPct / maxPct) * 100}%`, backgroundColor: 'hsl(var(--muted-foreground) / 0.4)', height: '100%' }} />
                    </div>
                    {/* Your bar */}
                    <div className="h-1 bg-surface-3 overflow-hidden">
                      <div style={{
                        width: `${(b.yourPct / maxPct) * 100}%`,
                        backgroundColor: over && yourPct - b.blsPct > 5 ? 'hsl(var(--expense))' : 'hsl(var(--income))',
                        height: '100%',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-muted-foreground/40 inline-block" /> National avg</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-income inline-block" /> Your spend</span>
            </div>
          </div>
        </div>

        {/* Top merchants */}
        <div className="border border-border bg-surface-1 p-4">
          <p className="ticker mb-4">Top Merchants (All Time)</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMerchants} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={AXIS_STYLE} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS_STYLE} width={110} axisLine={false} tickLine={false} />
                <ReTooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--surface-3))' }} />
                <Bar dataKey="total" fill="hsl(var(--expense))" radius={0} name="Total Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Unusual transactions + largest expenses */}
        <div className="space-y-3">
          {unusualTxns.length > 0 && (
            <div className="border border-border bg-surface-1 p-4">
              <p className="ticker mb-3">Unusual Charges (Last 30 Days)</p>
              <div className="space-y-0 divide-y divide-border">
                {unusualTxns.map(({ t, avg }) => (
                  <div key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 h-5 flex items-center justify-center bg-yellow-500/10 text-yellow-400 font-mono text-[9px] font-bold shrink-0">!</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{t.description}</p>
                      <p className="ticker">{t.date} · typical {formatCurrency(avg)}</p>
                    </div>
                    <span className="font-mono text-sm font-bold tabnum text-expense shrink-0">
                      {formatCurrency(Math.abs(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-border bg-surface-1 p-4">
            <p className="ticker mb-3">Largest Single Expenses (All Time)</p>
            <div className="space-y-0 divide-y divide-border">
              {largestExpenses.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 h-5 flex items-center justify-center bg-expense/10 text-expense font-mono text-[9px] font-bold shrink-0">
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

      {/* ════════════ WEALTH BUILDING METRICS ════════════ */}
      {dashData && (dashData as any).wealthMetrics && (() => {
        const wm = (dashData as any).wealthMetrics;
        const hm = (dashData as any).healthMetrics;
        const fm = (dashData as any).flexibilityMetrics;
        const ov = (dashData as any).overview;
        return (
          <>
            {/* FIRE Progress + Investment + Passive Income */}
            <div className="border border-border bg-surface-1 p-4">
              <p className="ticker mb-1">Wealth Building</p>
              <p className="text-[10px] text-muted-foreground font-mono mb-4">Financial independence metrics</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {/* FIRE Progress */}
                <div className="space-y-2">
                  <p className="ticker">FIRE Progress</p>
                  <p className="numeral text-2xl font-bold tabnum text-primary">
                    {wm.fireProgress > 0 ? `${wm.fireProgress.toFixed(1)}%` : '—'}
                  </p>
                  <div className="h-2 bg-surface-3 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(wm.fireProgress, 100)}%`, opacity: 0.8 }}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground font-mono">
                      FIRE Number: {formatCurrency(wm.fireNumber)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Net Worth: {formatCurrency(ov.netWorth)}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 font-mono">
                      25× annual expenses ({formatCurrency(wm.annualExpenses)}/yr)
                    </p>
                  </div>
                </div>

                {/* Investment Rate */}
                <div className="space-y-2">
                  <p className="ticker">Investment Rate</p>
                  <p className={cn('numeral text-2xl font-bold tabnum',
                    wm.investmentRate >= 15 ? 'text-income' : wm.investmentRate >= 5 ? 'text-yellow-400' : 'text-muted-foreground'
                  )}>
                    {wm.investmentRate.toFixed(1)}%
                  </p>
                  <div className="h-2 bg-surface-3 overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-700',
                        wm.investmentRate >= 15 ? 'bg-income' : wm.investmentRate >= 5 ? 'bg-yellow-400' : 'bg-muted-foreground'
                      )}
                      style={{ width: `${Math.min(wm.investmentRate / 20 * 100, 100)}%`, opacity: 0.7 }}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatCurrency(wm.investmentContributions)}/mo to investments
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatCurrency(wm.investmentAssets)} total invested
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 font-mono">Target: 15–20% of income</p>
                  </div>
                </div>

                {/* Passive Income Ratio */}
                <div className="space-y-2">
                  <p className="ticker">Passive Income</p>
                  <p className={cn('numeral text-2xl font-bold tabnum',
                    wm.passiveIncomeRatio >= 50 ? 'text-income' : wm.passiveIncomeRatio >= 10 ? 'text-yellow-400' : 'text-muted-foreground'
                  )}>
                    {wm.passiveIncomeRatio.toFixed(1)}%
                  </p>
                  <div className="h-2 bg-surface-3 overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-700',
                        wm.passiveIncomeRatio >= 50 ? 'bg-income' : wm.passiveIncomeRatio >= 10 ? 'bg-yellow-400' : 'bg-muted-foreground'
                      )}
                      style={{ width: `${Math.min(wm.passiveIncomeRatio, 100)}%`, opacity: 0.7 }}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatCurrency(wm.passiveIncome)}/mo passive
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatCurrency(ov.monthlyIncome)}/mo total income
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 font-mono">FI = 100% passive coverage</p>
                  </div>
                </div>
              </div>

              {/* Net Worth Growth */}
              {(wm.nwGrowthMoM || wm.nwGrowthYoY) && (
                <div className="border-t border-border pt-4 mt-2">
                  <p className="ticker mb-3">Net Worth Growth</p>
                  <div className="flex flex-wrap gap-6">
                    {wm.nwGrowthMoM && (() => {
                      const delta = wm.nwGrowthMoM.current - wm.nwGrowthMoM.previous;
                      const pct = wm.nwGrowthMoM.previous !== 0
                        ? (delta / Math.abs(wm.nwGrowthMoM.previous)) * 100
                        : 0;
                      return (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-mono mb-1">Month-over-Month</p>
                          <p className={cn('numeral text-lg font-bold tabnum', delta >= 0 ? 'text-income' : 'text-expense')}>
                            {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                          </p>
                          <p className={cn('text-[10px] font-mono', delta >= 0 ? 'text-income' : 'text-expense')}>
                            {delta >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                          </p>
                        </div>
                      );
                    })()}
                    {wm.nwGrowthYoY && (() => {
                      const delta = wm.nwGrowthYoY.current - wm.nwGrowthYoY.yearAgo;
                      const pct = wm.nwGrowthYoY.yearAgo !== 0
                        ? (delta / Math.abs(wm.nwGrowthYoY.yearAgo)) * 100
                        : 0;
                      return (
                        <div>
                          <p className="text-[10px] text-muted-foreground font-mono mb-1">Year-over-Year</p>
                          <p className={cn('numeral text-lg font-bold tabnum', delta >= 0 ? 'text-income' : 'text-expense')}>
                            {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                          </p>
                          <p className={cn('text-[10px] font-mono', delta >= 0 ? 'text-income' : 'text-expense')}>
                            {delta >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* ════════════ EXPENSE GROWTH + YoY ════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="border border-border bg-surface-1 p-4">
                <p className="ticker mb-1">Expense Growth</p>
                <p className="text-[10px] text-muted-foreground font-mono mb-4">How your spending is changing</p>
                <div className="space-y-4">
                  {/* MoM */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-foreground/80">Month-over-Month</span>
                      <span className={cn('font-mono text-sm font-bold tabnum',
                        hm.expenseGrowthMoM > 5 ? 'text-expense' : hm.expenseGrowthMoM < -5 ? 'text-income' : 'text-muted-foreground'
                      )}>
                        {hm.expenseGrowthMoM >= 0 ? '+' : ''}{hm.expenseGrowthMoM.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                      <span>Last month: {formatCurrency(hm.lastMonthExpenses)}</span>
                      <span>→</span>
                      <span>This month: {formatCurrency(ov.monthlyExpenses)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-3 overflow-hidden mt-2">
                      <div
                        className={cn('h-full transition-all duration-700',
                          hm.expenseGrowthMoM > 5 ? 'bg-expense' : hm.expenseGrowthMoM < -5 ? 'bg-income' : 'bg-muted-foreground'
                        )}
                        style={{ width: `${Math.min(Math.abs(hm.expenseGrowthMoM), 100)}%`, opacity: 0.6 }}
                      />
                    </div>
                  </div>
                  {/* YoY */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-foreground/80">Year-over-Year</span>
                      <span className={cn('font-mono text-sm font-bold tabnum',
                        hm.expenseGrowthYoY > 5 ? 'text-expense' : hm.expenseGrowthYoY < -5 ? 'text-income' : 'text-muted-foreground'
                      )}>
                        {hm.yoyExpenses > 0 ? `${hm.expenseGrowthYoY >= 0 ? '+' : ''}${hm.expenseGrowthYoY.toFixed(1)}%` : 'No data'}
                      </span>
                    </div>
                    {hm.yoyExpenses > 0 && (
                      <>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                          <span>Same month last year: {formatCurrency(hm.yoyExpenses)}</span>
                          <span>→</span>
                          <span>This month: {formatCurrency(ov.monthlyExpenses)}</span>
                        </div>
                        <div className="h-1.5 bg-surface-3 overflow-hidden mt-2">
                          <div
                            className={cn('h-full transition-all duration-700',
                              hm.expenseGrowthYoY > 5 ? 'bg-expense' : hm.expenseGrowthYoY < -5 ? 'bg-income' : 'bg-muted-foreground'
                            )}
                            style={{ width: `${Math.min(Math.abs(hm.expenseGrowthYoY), 100)}%`, opacity: 0.6 }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Year-over-Year Income */}
              <div className="border border-border bg-surface-1 p-4">
                <p className="ticker mb-1">Year-over-Year Comparison</p>
                <p className="text-[10px] text-muted-foreground font-mono mb-4">Same month, this year vs last year</p>
                {hm.yoyIncome > 0 || hm.yoyExpenses > 0 ? (
                  <div className="space-y-4">
                    {[
                      {
                        label: 'Income',
                        current: ov.monthlyIncome,
                        previous: hm.yoyIncome,
                        color: 'income',
                      },
                      {
                        label: 'Expenses',
                        current: ov.monthlyExpenses,
                        previous: hm.yoyExpenses,
                        color: 'expense',
                      },
                      {
                        label: 'Net Savings',
                        current: ov.monthlyIncome - ov.monthlyExpenses,
                        previous: hm.yoyIncome - hm.yoyExpenses,
                        color: 'primary',
                      },
                    ].map(item => {
                      const delta = item.previous > 0
                        ? ((item.current - item.previous) / item.previous) * 100
                        : 0;
                      const improved = item.label === 'Expenses' ? delta < 0 : delta > 0;
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-mono text-foreground/80">{item.label}</span>
                            {item.previous > 0 && (
                              <span className={cn('font-mono text-xs font-semibold tabnum',
                                improved ? 'text-income' : 'text-expense'
                              )}>
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <p className="text-[9px] text-muted-foreground font-mono mb-1">Last Year</p>
                              <div className="h-5 bg-surface-3 overflow-hidden flex items-center px-2">
                                <span className="text-[10px] font-mono font-semibold tabnum text-muted-foreground">
                                  {item.previous > 0 ? formatCurrency(item.previous) : '—'}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-[9px] text-muted-foreground font-mono mb-1">This Year</p>
                              <div className={cn('h-5 overflow-hidden flex items-center px-2',
                                `bg-${item.color}/10`
                              )}>
                                <span className={cn('text-[10px] font-mono font-semibold tabnum', `text-${item.color}`)}>
                                  {formatCurrency(item.current)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6 font-mono">
                    No data from the same month last year
                  </p>
                )}
              </div>
            </div>

            {/* ════════════ INCOME DIVERSIFICATION + RECURRING VS DISCRETIONARY ════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Income Diversification */}
              <div className="border border-border bg-surface-1 p-4">
                <p className="ticker mb-1">Income Diversification</p>
                <p className="text-[10px] text-muted-foreground font-mono mb-4">
                  {fm.incomeStreams} income {fm.incomeStreams === 1 ? 'source' : 'sources'} this month
                </p>

                {fm.incomeStreams === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 font-mono">No income recorded this month</p>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      {Object.entries(fm.incomeBySource as Record<string, number>)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([source, amount]) => {
                          const pct = ov.monthlyIncome > 0 ? ((amount as number) / ov.monthlyIncome) * 100 : 0;
                          const isConcentrated = pct > 80;
                          return (
                            <div key={source}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <CategoryDot category={source} />
                                  <span className="text-xs font-mono text-foreground/80">{source}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                                  <span className="font-mono text-xs font-semibold tabnum text-income">{formatCurrency(amount as number)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-surface-3 overflow-hidden">
                                <div
                                  className={cn('h-full transition-all duration-700', isConcentrated ? 'bg-yellow-400' : 'bg-income')}
                                  style={{ width: `${pct}%`, opacity: 0.7 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Concentration warning */}
                    {fm.incomeStreams === 1 && (
                      <div className="border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 flex gap-2 items-start">
                        <span className="text-yellow-400 text-xs mt-0.5">⚠</span>
                        <div>
                          <p className="text-[10px] font-semibold font-mono text-yellow-400">Single income source</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">100% income concentration creates risk. Consider diversifying.</p>
                        </div>
                      </div>
                    )}
                    {fm.incomeStreams >= 3 && (
                      <div className="border border-green-500/30 bg-green-500/5 px-3 py-2 flex gap-2 items-start">
                        <span className="text-green-400 text-xs mt-0.5">✓</span>
                        <div>
                          <p className="text-[10px] font-semibold font-mono text-green-400">Well diversified</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fm.incomeStreams} income streams reduce financial risk.</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Recurring vs Discretionary */}
              <div className="border border-border bg-surface-1 p-4">
                <p className="ticker mb-1">Recurring vs Discretionary</p>
                <p className="text-[10px] text-muted-foreground font-mono mb-4">How flexible is your spending?</p>

                {ov.monthlyExpenses > 0 ? (
                  <>
                    {/* Visual split bar */}
                    <div className="h-8 flex overflow-hidden mb-4">
                      <div
                        className="bg-expense/60 flex items-center justify-center transition-all duration-700"
                        style={{ width: `${fm.recurringRatio}%` }}
                      >
                        {fm.recurringRatio > 15 && (
                          <span className="text-[10px] font-mono font-bold text-white/90">
                            {fm.recurringRatio.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div
                        className="bg-primary/50 flex items-center justify-center transition-all duration-700"
                        style={{ width: `${100 - fm.recurringRatio}%` }}
                      >
                        {100 - fm.recurringRatio > 15 && (
                          <span className="text-[10px] font-mono font-bold text-white/90">
                            {(100 - fm.recurringRatio).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 bg-expense/60" />
                          <span className="ticker">Fixed / Recurring</span>
                        </div>
                        <p className="numeral text-lg font-bold tabnum text-expense">
                          {formatCurrency(fm.recurringExpenses)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Rent, utilities, insurance, subs
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 bg-primary/50" />
                          <span className="ticker">Discretionary</span>
                        </div>
                        <p className="numeral text-lg font-bold tabnum text-primary">
                          {formatCurrency(fm.discretionaryExpenses)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Shopping, dining, entertainment
                        </p>
                      </div>
                    </div>

                    {/* Flexibility assessment */}
                    <div className={cn(
                      'border px-3 py-2 flex gap-2 items-start',
                      fm.recurringRatio > 70 ? 'border-expense/30 bg-expense/5' :
                      fm.recurringRatio > 50 ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-green-500/30 bg-green-500/5'
                    )}>
                      <span className={cn('text-xs mt-0.5',
                        fm.recurringRatio > 70 ? 'text-expense' :
                        fm.recurringRatio > 50 ? 'text-yellow-400' :
                        'text-green-400'
                      )}>
                        {fm.recurringRatio > 70 ? '⚠' : fm.recurringRatio > 50 ? '◐' : '✓'}
                      </span>
                      <div>
                        <p className={cn('text-[10px] font-semibold font-mono',
                          fm.recurringRatio > 70 ? 'text-expense' :
                          fm.recurringRatio > 50 ? 'text-yellow-400' :
                          'text-green-400'
                        )}>
                          {fm.recurringRatio > 70 ? 'Low flexibility' :
                           fm.recurringRatio > 50 ? 'Moderate flexibility' :
                           'High flexibility'}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {fm.recurringRatio > 70
                            ? `${fm.recurringRatio.toFixed(0)}% of spending is fixed. You have limited room to cut costs quickly.`
                            : fm.recurringRatio > 50
                            ? `${fm.recurringRatio.toFixed(0)}% fixed obligations. Some room to adjust in a pinch.`
                            : `Only ${fm.recurringRatio.toFixed(0)}% is locked in. You can quickly adjust spending if needed.`
                          }
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6 font-mono">No expenses recorded this month</p>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
