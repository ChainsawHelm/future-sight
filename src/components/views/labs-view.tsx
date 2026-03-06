'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { transactionsApi, subscriptionsApi, dashboardApi, waitlistApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { CategoryDot } from '@/components/shared/category-badge';
import { formatCurrency, cn } from '@/lib/utils';
import { isRealExpense, isRealIncome } from '@/lib/classify';
import { Input } from '@/components/ui/input';
import type { Transaction } from '@/types/models';

// ─── Fed SCF 2022 Net Worth Percentiles by Age ─────────────
const PEER_DATA: { age: string; p25: number; p50: number; p75: number; p90: number }[] = [
  { age: 'Under 35',  p25: 4700,    p50: 39000,    p75: 170400,   p90: 459000 },
  { age: '35–44',     p25: 27500,   p50: 135600,   p75: 420600,   p90: 1029000 },
  { age: '45–54',     p25: 47200,   p50: 247200,   p75: 714100,   p90: 1665000 },
  { age: '55–64',     p25: 67500,   p50: 364500,   p75: 1043000,  p90: 2454000 },
  { age: '65–74',     p25: 112800,  p50: 410000,   p75: 1170000,  p90: 2750000 },
  { age: '75+',       p25: 95800,   p50: 335600,   p75: 891000,   p90: 1960000 },
];

// ─── Utility category detection ─────────────────────────────
const UTILITY_CATEGORIES = ['Utilities', 'Electric', 'Gas', 'Water', 'Sewer', 'Internet', 'Phone', 'Cable', 'Trash'];
const isUtility = (cat: string) => UTILITY_CATEGORIES.some(u => cat.toLowerCase().includes(u.toLowerCase()));

export function LabsView() {
  const { data: txData, error: txError, isLoading: txLoading, refetch: txRefetch } = useFetch<{ transactions: Transaction[] }>(
    () => transactionsApi.list({ limit: 5000, sort: 'date', order: 'desc' }), []
  );
  const { data: subData } = useFetch<any>(() => subscriptionsApi.list(), []);
  const { data: dashData } = useFetch<any>(() => dashboardApi.get(), []);
  const { data: waitData, refetch: waitRefetch } = useFetch<any>(() => waitlistApi.list(), []);

  if (txLoading) return <PageLoader message="Loading labs..." />;
  if (txError) return <ErrorAlert message={txError} retry={txRefetch} />;

  const txns: Transaction[] = txData?.transactions || [];
  const subscriptions = subData?.subscriptions || [];
  const overview = dashData?.overview || {};
  const waitItems = waitData?.items || [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-dashed border-yellow-500/30 bg-yellow-500/[0.03] px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-mono font-bold text-yellow-500/80 tracking-[0.2em] bg-yellow-500/10 px-2 py-0.5">TESTING</span>
          <p className="ticker text-yellow-500/60">Experimental Features</p>
        </div>
        <h1 className="text-xl font-bold tracking-tight">Labs</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Features under development. Data is live but these may change or be removed.
        </p>
      </div>

      {/* ════════════ 1. UTILITIES CREEP ════════════ */}
      <UtilitiesCreep txns={txns} />

      {/* ════════════ 2. SUBSCRIPTION CREEP ════════════ */}
      <SubscriptionCreep txns={txns} subscriptions={subscriptions} />

      {/* ════════════ 3. TRUE HOURLY WAGE ════════════ */}
      <TrueHourlyWage monthlyIncome={overview.monthlyIncome || 0} />

      {/* ════════════ 4. LATTE FACTOR ════════════ */}
      <LatteFactor txns={txns} />

      {/* ════════════ 5. PURCHASE WAIT LIST ════════════ */}
      <PurchaseWaitList items={waitItems} refetch={waitRefetch} />

      {/* ════════════ 6. LIFESTYLE INFLATION ════════════ */}
      <LifestyleInflation txns={txns} />

      {/* ════════════ 7. PEER BENCHMARKING ════════════ */}
      <PeerBenchmark netWorth={overview.netWorth || 0} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. UTILITIES CREEP
// ─────────────────────────────────────────────────────────────
function UtilitiesCreep({ txns }: { txns: Transaction[] }) {
  const byMonth: Record<string, number> = {};
  for (const t of txns) {
    if (!isRealExpense(t) || !isUtility(t.category)) continue;
    const m = t.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + Math.abs(t.amount);
  }

  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 2) {
    return (
      <LabCard title="Utilities Creep" icon="~">
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Need at least 2 months of utility data to track creep.
        </p>
      </LabCard>
    );
  }

  const first3Avg = months.slice(0, 3).reduce((s, [, v]) => s + v, 0) / Math.min(months.length, 3);
  const last3Avg = months.slice(-3).reduce((s, [, v]) => s + v, 0) / Math.min(months.length, 3);
  const creepPct = first3Avg > 0 ? ((last3Avg - first3Avg) / first3Avg) * 100 : 0;
  const annualCreep = (last3Avg - first3Avg) * 12;

  return (
    <LabCard title="Utilities Creep" icon="~">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="ticker mb-1">Early Average</p>
          <p className="numeral text-lg font-bold tabnum">{formatCurrency(first3Avg)}</p>
          <p className="text-[9px] text-muted-foreground font-mono">First 3 months</p>
        </div>
        <div>
          <p className="ticker mb-1">Recent Average</p>
          <p className="numeral text-lg font-bold tabnum">{formatCurrency(last3Avg)}</p>
          <p className="text-[9px] text-muted-foreground font-mono">Last 3 months</p>
        </div>
        <div>
          <p className="ticker mb-1">Creep</p>
          <p className={cn('numeral text-lg font-bold tabnum', creepPct > 5 ? 'text-expense' : creepPct < -5 ? 'text-income' : 'text-muted-foreground')}>
            {creepPct >= 0 ? '+' : ''}{creepPct.toFixed(1)}%
          </p>
          <p className="text-[9px] text-muted-foreground font-mono">
            {annualCreep >= 0 ? '+' : ''}{formatCurrency(annualCreep)}/yr
          </p>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="space-y-1.5">
        {months.slice(-12).map(([m, v]) => {
          const maxVal = Math.max(...months.map(([, v2]) => v2));
          const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
          return (
            <div key={m} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0">{m.slice(2)}</span>
              <div className="flex-1 h-4 bg-surface-3 overflow-hidden relative">
                <div
                  className={cn('h-full transition-all duration-500', v > last3Avg * 1.1 ? 'bg-expense/50' : 'bg-primary/40')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono tabnum text-muted-foreground w-16 text-right">{formatCurrency(v)}</span>
            </div>
          );
        })}
      </div>
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. SUBSCRIPTION CREEP
// ─────────────────────────────────────────────────────────────
function SubscriptionCreep({ txns, subscriptions }: { txns: Transaction[]; subscriptions: any[] }) {
  // Track subscription-category spending by month
  const subCategories = ['Subscriptions', 'Streaming', 'Software', 'Membership', 'Netflix', 'Spotify', 'Hulu', 'Disney'];
  const byMonth: Record<string, number> = {};
  for (const t of txns) {
    if (!isRealExpense(t)) continue;
    if (!subCategories.some(s => t.category.toLowerCase().includes(s.toLowerCase()) || t.description.toLowerCase().includes(s.toLowerCase()))) continue;
    const m = t.date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + Math.abs(t.amount);
  }

  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));

  // Current active subs total
  const activeSubs = subscriptions.filter((s: any) => s.isActive);
  const currentMonthly = activeSubs.reduce((s: number, sub: any) => {
    const m = sub.frequency === 'yearly' ? sub.amount / 12 : sub.frequency === 'weekly' ? sub.amount * 4.33 : sub.amount;
    return s + m;
  }, 0);

  const first3Avg = months.length >= 3 ? months.slice(0, 3).reduce((s, [, v]) => s + v, 0) / 3 : 0;
  const last3Avg = months.length >= 3 ? months.slice(-3).reduce((s, [, v]) => s + v, 0) / 3 : currentMonthly;
  const creepPct = first3Avg > 0 ? ((last3Avg - first3Avg) / first3Avg) * 100 : 0;

  return (
    <LabCard title="Subscription Creep" icon="$">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="ticker mb-1">Active Subs</p>
          <p className="numeral text-lg font-bold tabnum text-primary">{activeSubs.length}</p>
        </div>
        <div>
          <p className="ticker mb-1">Monthly Cost</p>
          <p className="numeral text-lg font-bold tabnum text-expense">{formatCurrency(currentMonthly)}</p>
        </div>
        <div>
          <p className="ticker mb-1">Annual Cost</p>
          <p className="numeral text-lg font-bold tabnum text-expense">{formatCurrency(currentMonthly * 12)}</p>
        </div>
        <div>
          <p className="ticker mb-1">Creep</p>
          <p className={cn('numeral text-lg font-bold tabnum', creepPct > 5 ? 'text-expense' : 'text-muted-foreground')}>
            {months.length >= 6 ? `${creepPct >= 0 ? '+' : ''}${creepPct.toFixed(0)}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Individual sub breakdown */}
      {activeSubs.length > 0 && (
        <div className="space-y-2">
          <p className="ticker mb-2">Active Subscriptions</p>
          {activeSubs
            .sort((a: any, b: any) => b.amount - a.amount)
            .map((sub: any) => {
              const monthly = sub.frequency === 'yearly' ? sub.amount / 12 : sub.frequency === 'weekly' ? sub.amount * 4.33 : sub.amount;
              return (
                <div key={sub.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <CategoryDot category={sub.category || 'Subscriptions'} />
                  <span className="text-xs font-medium flex-1 truncate">{sub.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{sub.frequency}</span>
                  <span className="text-xs font-mono font-bold tabnum text-expense">{formatCurrency(monthly)}/mo</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Monthly trend */}
      {months.length >= 3 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="ticker mb-2">Monthly Subscription Spending Trend</p>
          <div className="space-y-1">
            {months.slice(-8).map(([m, v]) => {
              const maxVal = Math.max(...months.map(([, v2]) => v2));
              const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0">{m.slice(2)}</span>
                  <div className="flex-1 h-3 bg-surface-3 overflow-hidden">
                    <div className="h-full bg-expense/40 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono tabnum text-muted-foreground w-14 text-right">{formatCurrency(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. TRUE HOURLY WAGE
// ─────────────────────────────────────────────────────────────
function TrueHourlyWage({ monthlyIncome }: { monthlyIncome: number }) {
  const [hoursPerWeek, setHoursPerWeek] = useState('40');
  const [commuteHours, setCommuteHours] = useState('5');
  const [commuteCost, setCommuteCost] = useState('200');
  const [workExpenses, setWorkExpenses] = useState('100');
  const [taxRate, setTaxRate] = useState('25');

  const hrs = parseFloat(hoursPerWeek) || 40;
  const commHrs = parseFloat(commuteHours) || 0;
  const commCost = parseFloat(commuteCost) || 0;
  const workExp = parseFloat(workExpenses) || 0;
  const tax = parseFloat(taxRate) || 25;

  const grossMonthly = monthlyIncome;
  const afterTax = grossMonthly * (1 - tax / 100);
  const netAfterExpenses = afterTax - commCost - workExp;
  const totalHoursMonth = (hrs + commHrs) * 4.33;
  const trueHourly = totalHoursMonth > 0 ? netAfterExpenses / totalHoursMonth : 0;
  const standardHourly = hrs * 4.33 > 0 ? grossMonthly / (hrs * 4.33) : 0;

  return (
    <LabCard title="True Hourly Wage" icon="@">
      <p className="text-[10px] text-muted-foreground font-mono mb-4">
        What you actually earn per hour after taxes, commuting, and work expenses.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <div>
          <label className="ticker block mb-1">Work hrs/week</label>
          <Input type="number" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="ticker block mb-1">Commute hrs/week</label>
          <Input type="number" value={commuteHours} onChange={e => setCommuteHours(e.target.value)} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="ticker block mb-1">Commute $/mo</label>
          <Input type="number" value={commuteCost} onChange={e => setCommuteCost(e.target.value)} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="ticker block mb-1">Work expenses/mo</label>
          <Input type="number" value={workExpenses} onChange={e => setWorkExpenses(e.target.value)} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="ticker block mb-1">Tax rate %</label>
          <Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="h-8 text-xs font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="ticker mb-1">Gross Hourly</p>
          <p className="numeral text-xl font-bold tabnum text-muted-foreground">{formatCurrency(standardHourly)}</p>
          <p className="text-[9px] text-muted-foreground font-mono">Before deductions</p>
        </div>
        <div>
          <p className="ticker mb-1">True Hourly</p>
          <p className={cn('numeral text-xl font-bold tabnum', trueHourly > 0 ? 'text-primary' : 'text-expense')}>
            {formatCurrency(trueHourly)}
          </p>
          <p className="text-[9px] text-muted-foreground font-mono">After everything</p>
        </div>
        <div>
          <p className="ticker mb-1">Lost to Overhead</p>
          <p className="numeral text-xl font-bold tabnum text-expense">
            {standardHourly > 0 ? `${((1 - trueHourly / standardHourly) * 100).toFixed(0)}%` : '—'}
          </p>
          <p className="text-[9px] text-muted-foreground font-mono">{formatCurrency(standardHourly - trueHourly)}/hr</p>
        </div>
        <div>
          <p className="ticker mb-1">Monthly True Take-Home</p>
          <p className="numeral text-xl font-bold tabnum text-income">{formatCurrency(netAfterExpenses)}</p>
          <p className="text-[9px] text-muted-foreground font-mono">{totalHoursMonth.toFixed(0)} hrs/mo total</p>
        </div>
      </div>

      {/* Example purchases in hours */}
      {trueHourly > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="ticker mb-2">What things cost in hours of your life</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '$5 Coffee', amt: 5 },
              { label: '$15 Lunch', amt: 15 },
              { label: '$50 Dinner', amt: 50 },
              { label: '$100 Shopping', amt: 100 },
              { label: '$200 Phone Bill', amt: 200 },
              { label: '$500 Weekend Trip', amt: 500 },
              { label: '$1,000 Purchase', amt: 1000 },
              { label: '$2,000 Vacation', amt: 2000 },
            ].map(ex => (
              <div key={ex.label} className="bg-surface-2 px-3 py-2">
                <p className="text-[10px] text-muted-foreground font-mono">{ex.label}</p>
                <p className="text-sm font-bold font-mono tabnum text-primary">{(ex.amt / trueHourly).toFixed(1)} hrs</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. LATTE FACTOR
// ─────────────────────────────────────────────────────────────
function LatteFactor({ txns }: { txns: Transaction[] }) {
  // Find small recurring purchases (< $20, same merchant 3+ times in 90 days)
  const ninetyAgo = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const recentExpenses = txns.filter(t => isRealExpense(t) && t.date >= ninetyAgo && Math.abs(t.amount) < 20);

  const merchantCounts: Record<string, { count: number; total: number; avgAmount: number }> = {};
  for (const t of recentExpenses) {
    const key = t.description.toUpperCase().slice(0, 25).trim();
    if (!merchantCounts[key]) merchantCounts[key] = { count: 0, total: 0, avgAmount: 0 };
    merchantCounts[key].count++;
    merchantCounts[key].total += Math.abs(t.amount);
  }
  for (const k of Object.keys(merchantCounts)) {
    merchantCounts[k].avgAmount = merchantCounts[k].total / merchantCounts[k].count;
  }

  const latteItems = Object.entries(merchantCounts)
    .filter(([, v]) => v.count >= 3)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10);

  const totalLatteMonthly = latteItems.reduce((s, [, v]) => s + (v.total / 3), 0); // 90 days = ~3 months
  const totalLatteAnnual = totalLatteMonthly * 12;
  const invested25yr = totalLatteAnnual * ((Math.pow(1.07, 25) - 1) / 0.07); // 7% annual return

  return (
    <LabCard title="The Latte Factor" icon="#">
      <p className="text-[10px] text-muted-foreground font-mono mb-4">
        Small recurring purchases (&lt;$20) made 3+ times in the last 90 days and their long-term compounding cost.
      </p>

      {latteItems.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">No frequent small purchases detected.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="ticker mb-1">Monthly Cost</p>
              <p className="numeral text-lg font-bold tabnum text-expense">{formatCurrency(totalLatteMonthly)}</p>
            </div>
            <div>
              <p className="ticker mb-1">Annual Cost</p>
              <p className="numeral text-lg font-bold tabnum text-expense">{formatCurrency(totalLatteAnnual)}</p>
            </div>
            <div>
              <p className="ticker mb-1">25yr Invested (7%)</p>
              <p className="numeral text-lg font-bold tabnum text-primary">{formatCurrency(invested25yr)}</p>
            </div>
          </div>

          <div className="space-y-2">
            {latteItems.map(([name, data]) => {
              const monthly = data.total / 3;
              const annual = monthly * 12;
              const compound = annual * ((Math.pow(1.07, 25) - 1) / 0.07);
              return (
                <div key={name} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{name}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">
                      {data.count}x in 90 days · avg {formatCurrency(data.avgAmount)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-bold tabnum text-expense">{formatCurrency(monthly)}/mo</p>
                    <p className="text-[9px] font-mono text-muted-foreground">{formatCurrency(compound)} over 25yr</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. PURCHASE WAIT LIST (30-Day Rule)
// ─────────────────────────────────────────────────────────────
function PurchaseWaitList({ items, refetch }: { items: any[]; refetch: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', category: '' });
  const createItem = useMutation(useCallback((d: any) => waitlistApi.create(d), []));
  const updateItem = useMutation(useCallback((d: any) => waitlistApi.update(d.id, d.status), []));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createItem.mutate({ name: form.name, amount: parseFloat(form.amount), category: form.category || undefined });
    setForm({ name: '', amount: '', category: '' });
    setShowForm(false);
    refetch();
  };

  const handleAction = async (id: string, status: 'bought' | 'skipped') => {
    await updateItem.mutate({ id, status });
    refetch();
  };

  const waiting = items.filter((i: any) => i.status === 'waiting');
  const resolved = items.filter((i: any) => i.status !== 'waiting');
  const totalSaved = resolved.filter((i: any) => i.status === 'skipped').reduce((s: number, i: any) => s + i.amount, 0);

  const now = new Date();

  return (
    <LabCard title="Purchase Wait List" icon="!">
      <p className="text-[10px] text-muted-foreground font-mono mb-3">
        The 30-day rule: add something you want to buy. If you still want it after 30 days, buy it. Otherwise, skip it.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="bg-surface-2 px-3 py-2">
          <p className="ticker">Waiting</p>
          <p className="numeral text-lg font-bold tabnum">{waiting.length}</p>
        </div>
        <div className="bg-surface-2 px-3 py-2">
          <p className="ticker">Saved by Skipping</p>
          <p className="numeral text-lg font-bold tabnum text-income">{formatCurrency(totalSaved)}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto h-8 px-3 border border-border bg-surface-2 text-xs font-mono hover:border-primary/50 hover:text-primary transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-4 p-3 border border-border bg-surface-2">
          <Input placeholder="What do you want to buy?" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="flex-1 min-w-[200px] h-8 text-xs" />
          <Input type="number" step="0.01" placeholder="Price" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required className="w-28 h-8 text-xs" />
          <Input placeholder="Category (optional)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-36 h-8 text-xs" />
          <button type="submit" className="h-8 px-4 bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/85 transition-colors">
            Start 30-Day Timer
          </button>
        </form>
      )}

      {/* Waiting items */}
      {waiting.length > 0 && (
        <div className="space-y-0 divide-y divide-border">
          {waiting.map((item: any) => {
            const expires = new Date(item.expiresAt);
            const daysLeft = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / 864e5));
            const isReady = daysLeft === 0;
            const pct = Math.min(100, ((30 - daysLeft) / 30) * 100);
            return (
              <div key={item.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    {isReady && <span className="text-[8px] font-mono font-bold text-income bg-income/10 px-1.5 py-0.5">READY</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {formatCurrency(item.amount)} · {isReady ? '30 days passed' : `${daysLeft} days left`}
                  </p>
                  <div className="h-1 bg-surface-3 mt-1.5 overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-500', isReady ? 'bg-income' : 'bg-primary/50')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => handleAction(item.id, 'bought')} className="h-7 px-2 text-[10px] font-mono border border-border hover:border-expense hover:text-expense transition-colors">
                    Bought
                  </button>
                  <button onClick={() => handleAction(item.id, 'skipped')} className="h-7 px-2 text-[10px] font-mono border border-border hover:border-income hover:text-income transition-colors">
                    Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved history */}
      {resolved.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="ticker mb-2">History</p>
          <div className="space-y-1">
            {resolved.slice(0, 8).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 py-1.5">
                <span className={cn('w-5 h-5 flex items-center justify-center text-[9px] font-bold font-mono',
                  item.status === 'skipped' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                )}>
                  {item.status === 'skipped' ? '✓' : '×'}
                </span>
                <span className="text-xs truncate flex-1">{item.name}</span>
                <span className={cn('text-[10px] font-mono font-bold tabnum',
                  item.status === 'skipped' ? 'text-income' : 'text-expense'
                )}>
                  {item.status === 'skipped' ? 'Saved ' : 'Spent '}{formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. LIFESTYLE INFLATION DETECTOR
// ─────────────────────────────────────────────────────────────
function LifestyleInflation({ txns }: { txns: Transaction[] }) {
  // Group by month, compute income and expense totals, track the ratio
  const byMonth: Record<string, { income: number; expenses: number }> = {};
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { income: 0, expenses: 0 };
    if (isRealIncome(t)) byMonth[m].income += t.amount;
    else if (isRealExpense(t)) byMonth[m].expenses += Math.abs(t.amount);
  }

  const months = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, d]) => d.income > 0)
    .map(([m, d]) => ({
      month: m,
      income: d.income,
      expenses: d.expenses,
      ratio: d.income > 0 ? (d.expenses / d.income) * 100 : 0,
    }));

  if (months.length < 4) {
    return (
      <LabCard title="Lifestyle Inflation Detector" icon="%">
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Need at least 4 months of income data to detect lifestyle inflation.
        </p>
      </LabCard>
    );
  }

  const first3 = months.slice(0, 3);
  const last3 = months.slice(-3);
  const earlyRatio = first3.reduce((s, m) => s + m.ratio, 0) / 3;
  const recentRatio = last3.reduce((s, m) => s + m.ratio, 0) / 3;
  const earlyIncome = first3.reduce((s, m) => s + m.income, 0) / 3;
  const recentIncome = last3.reduce((s, m) => s + m.income, 0) / 3;
  const incomeGrowth = earlyIncome > 0 ? ((recentIncome - earlyIncome) / earlyIncome) * 100 : 0;
  const ratioChange = recentRatio - earlyRatio;
  const inflating = ratioChange > 3 && incomeGrowth > 5;

  return (
    <LabCard title="Lifestyle Inflation Detector" icon="%">
      <p className="text-[10px] text-muted-foreground font-mono mb-4">
        Tracks whether your spending-to-income ratio is creeping up as your income grows.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="ticker mb-1">Income Growth</p>
          <p className={cn('numeral text-lg font-bold tabnum', incomeGrowth > 0 ? 'text-income' : 'text-muted-foreground')}>
            {incomeGrowth >= 0 ? '+' : ''}{incomeGrowth.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="ticker mb-1">Early Spend Ratio</p>
          <p className="numeral text-lg font-bold tabnum">{earlyRatio.toFixed(1)}%</p>
        </div>
        <div>
          <p className="ticker mb-1">Recent Spend Ratio</p>
          <p className={cn('numeral text-lg font-bold tabnum', recentRatio > earlyRatio + 3 ? 'text-expense' : 'text-income')}>
            {recentRatio.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="ticker mb-1">Verdict</p>
          <p className={cn('text-xs font-mono font-bold', inflating ? 'text-expense' : 'text-income')}>
            {inflating ? 'INFLATING' : ratioChange > 0 ? 'WATCH' : 'HEALTHY'}
          </p>
        </div>
      </div>

      {/* Ratio over time */}
      <div className="space-y-1">
        {months.slice(-12).map(m => (
          <div key={m.month} className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0">{m.month.slice(2)}</span>
            <div className="flex-1 h-4 bg-surface-3 overflow-hidden relative">
              <div
                className={cn('h-full transition-all duration-500', m.ratio > 85 ? 'bg-expense/50' : m.ratio > 70 ? 'bg-yellow-400/40' : 'bg-income/40')}
                style={{ width: `${Math.min(m.ratio, 100)}%` }}
              />
            </div>
            <span className={cn('text-[10px] font-mono tabnum w-12 text-right',
              m.ratio > 85 ? 'text-expense' : m.ratio > 70 ? 'text-yellow-400' : 'text-muted-foreground'
            )}>
              {m.ratio.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {inflating && (
        <div className="mt-4 border border-expense/30 bg-expense/5 px-3 py-2 flex gap-2 items-start">
          <span className="text-expense text-xs mt-0.5">!</span>
          <div>
            <p className="text-[10px] font-semibold font-mono text-expense">Lifestyle inflation detected</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Your income grew {incomeGrowth.toFixed(0)}% but your spending ratio increased by {ratioChange.toFixed(0)} points.
              The extra income is being absorbed by higher spending instead of savings.
            </p>
          </div>
        </div>
      )}
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. PEER BENCHMARKING
// ─────────────────────────────────────────────────────────────
function PeerBenchmark({ netWorth }: { netWorth: number }) {
  const [selectedAge, setSelectedAge] = useState('35–44');
  const peer = PEER_DATA.find(p => p.age === selectedAge) || PEER_DATA[1];

  // Determine percentile
  let percentile = 'Below 25th';
  let pctColor = 'text-expense';
  if (netWorth >= peer.p90) { percentile = 'Top 10%'; pctColor = 'text-income'; }
  else if (netWorth >= peer.p75) { percentile = '75th–90th'; pctColor = 'text-income'; }
  else if (netWorth >= peer.p50) { percentile = '50th–75th'; pctColor = 'text-primary'; }
  else if (netWorth >= peer.p25) { percentile = '25th–50th'; pctColor = 'text-yellow-400'; }

  const maxVal = peer.p90 * 1.1;

  return (
    <LabCard title="Peer Benchmarking" icon="&">
      <p className="text-[10px] text-muted-foreground font-mono mb-4">
        How your net worth compares to others in your age group. Source: Federal Reserve Survey of Consumer Finances 2022.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span className="ticker">Age Group:</span>
        <select
          value={selectedAge}
          onChange={e => setSelectedAge(e.target.value)}
          className="h-8 border border-border bg-surface-1 px-3 text-xs font-mono focus:outline-none focus:border-primary"
        >
          {PEER_DATA.map(p => <option key={p.age} value={p.age}>{p.age}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="ticker mb-1">Your Net Worth</p>
          <p className="numeral text-2xl font-bold tabnum text-primary">{formatCurrency(netWorth)}</p>
        </div>
        <div>
          <p className="ticker mb-1">Your Percentile</p>
          <p className={cn('numeral text-2xl font-bold', pctColor)}>{percentile}</p>
        </div>
      </div>

      {/* Visual comparison */}
      <div className="space-y-3">
        {[
          { label: '25th Percentile', value: peer.p25 },
          { label: '50th (Median)', value: peer.p50 },
          { label: '75th Percentile', value: peer.p75 },
          { label: '90th Percentile', value: peer.p90 },
          { label: 'You', value: netWorth, isYou: true },
        ]
          .sort((a, b) => a.value - b.value)
          .map((item, i) => {
            const pct = maxVal > 0 ? (Math.max(item.value, 0) / maxVal) * 100 : 0;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-[10px] font-mono',
                    (item as any).isYou ? 'text-primary font-bold' : 'text-muted-foreground'
                  )}>
                    {item.label}
                  </span>
                  <span className={cn('text-[10px] font-mono font-bold tabnum',
                    (item as any).isYou ? 'text-primary' : 'text-foreground/60'
                  )}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
                <div className="h-2 bg-surface-3 overflow-hidden">
                  <div
                    className={cn('h-full transition-all duration-700',
                      (item as any).isYou ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </LabCard>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED: Lab Card wrapper
// ─────────────────────────────────────────────────────────────
function LabCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-yellow-500/20 bg-surface-1 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 flex items-center justify-center bg-yellow-500/10 text-yellow-500 font-mono text-xs font-bold shrink-0">
          {icon}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[8px] font-mono font-bold text-yellow-500/50 tracking-wider bg-yellow-500/[0.06] px-1.5 py-0.5">LAB</span>
      </div>
      {children}
    </div>
  );
}
