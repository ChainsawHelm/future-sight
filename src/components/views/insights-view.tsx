'use client';

import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi, budgetsApi, subscriptionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryDot, getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency, cn } from '@/lib/utils';
import { isRealExpense, isRealIncome } from '@/lib/classify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import type { Transaction } from '@/types/models';

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

const AXIS_STYLE = { fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'hsl(var(--muted-foreground))' };

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-surface-2 px-3 py-2 shadow-lg text-xs font-mono">
      {label && <p className="text-muted-foreground mb-1 uppercase tracking-wider text-[10px]">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

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
    </div>
  );
}
