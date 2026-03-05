'use client';

import { useRouter } from 'next/navigation';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, cn } from '@/lib/utils';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export function HeatmapView() {
  const router = useRouter();
  const { data, error, isLoading, refetch } = useFetch(
    () => transactionsApi.list({ limit: 1000, sort: 'date', order: 'desc' }), []
  );

  const txns = data?.transactions || [];

  if (isLoading) return <PageLoader message="Loading heatmap..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (txns.length === 0) return (
    <EmptyState title="No data" description="Import transactions to see your spending heatmap." />
  );

  // Group spending by day
  const dailySpend: Record<string, number> = {};
  const dailyCount: Record<string, number> = {};
  for (const t of txns) {
    if (t.amount < 0) {
      dailySpend[t.date] = (dailySpend[t.date] || 0) + Math.abs(t.amount);
      dailyCount[t.date] = (dailyCount[t.date] || 0) + 1;
    }
  }

  const values = Object.values(dailySpend);
  const maxSpend = values.length > 0 ? Math.max(...values) : 1;
  const totalYearSpend = values.reduce((s, v) => s + v, 0);
  const activeDays = values.filter(v => v > 0).length;
  const busiestDate = Object.entries(dailySpend).sort(([, a], [, b]) => b - a)[0];
  const avgDaily = activeDays > 0 ? totalYearSpend / activeDays : 0;

  // Generate last 365 days
  const today = new Date();
  const days: { date: string; spend: number; dayOfWeek: number; monthNum: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      spend: dailySpend[dateStr] || 0,
      dayOfWeek: d.getDay(),
      monthNum: d.getMonth(),
    });
  }

  // Group into weeks
  const weeks: typeof days[] = [];
  let currentWeek: typeof days = [];
  // Pad first week with empty days
  if (days[0].dayOfWeek > 0) {
    for (let i = 0; i < days[0].dayOfWeek; i++) {
      currentWeek.push({ date: '', spend: 0, dayOfWeek: i, monthNum: -1 });
    }
  }
  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length) {
    while (currentWeek.length < 7) currentWeek.push({ date: '', spend: 0, dayOfWeek: currentWeek.length, monthNum: -1 });
    weeks.push(currentWeek);
  }

  // Month label positions — find the first column where each month starts
  const monthPositions: { month: number; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstRealDay = week.find(d => d.date !== '');
    if (firstRealDay && firstRealDay.monthNum !== lastMonth) {
      monthPositions.push({ month: firstRealDay.monthNum, col: wi });
      lastMonth = firstRealDay.monthNum;
    }
  });

  const getColor = (spend: number): string => {
    if (spend === 0) return 'bg-surface-2 dark:bg-surface-2 border border-border';
    const intensity = spend / maxSpend;
    if (intensity < 0.2)  return 'bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800';
    if (intensity < 0.4)  return 'bg-violet-200 dark:bg-violet-800/60 border border-violet-300 dark:border-violet-700';
    if (intensity < 0.65) return 'bg-violet-400 dark:bg-violet-600 border border-violet-500 dark:border-violet-500';
    return 'bg-violet-600 dark:bg-violet-500 border border-violet-700 dark:border-violet-400';
  };

  const handleDayClick = (date: string) => {
    if (!date) return;
    router.push(`/transactions?dateFrom=${date}&dateTo=${date}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Spending Heatmap</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daily spending intensity — click any day to see transactions
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total (365 days)', value: formatCurrency(totalYearSpend), color: 'text-expense' },
          { label: 'Active spend days', value: `${activeDays} days`, color: 'text-foreground' },
          { label: 'Average spend day', value: formatCurrency(avgDaily), color: 'text-foreground' },
          { label: 'Busiest day', value: busiestDate ? busiestDate[0] : '—', color: 'text-primary' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <p className="ticker mb-1">{s.label}</p>
            <p className={cn('numeral text-lg font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Month labels */}
          <div className="flex gap-1 mb-1 ml-8">
            {weeks.map((_, wi) => {
              const mp = monthPositions.find(m => m.col === wi);
              return (
                <div key={wi} className="w-3 shrink-0 text-[9px] text-muted-foreground font-mono">
                  {mp ? MONTH_NAMES[mp.month] : ''}
                </div>
              );
            })}
          </div>

          <div className="flex gap-1">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-1 mr-2">
              {DOW_LABELS.map((d, i) => (
                <div key={i} className="h-3 text-[9px] text-muted-foreground flex items-center font-mono w-6">
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <button
                    key={di}
                    onClick={() => handleDayClick(day.date)}
                    disabled={!day.date}
                    title={
                      day.date
                        ? day.spend > 0
                          ? `${day.date}: ${formatCurrency(day.spend)} (${dailyCount[day.date] || 0} txns) — click to view`
                          : `${day.date}: No spending — click to view`
                        : ''
                    }
                    className={cn(
                      'w-3 h-3 rounded-sm transition-all duration-150',
                      day.date ? getColor(day.spend) : 'bg-transparent',
                      day.date && 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:scale-125'
                    )}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-5 text-[10px] text-muted-foreground font-mono">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm border border-border bg-surface-2" />
            <div className="w-3 h-3 rounded-sm bg-violet-100 dark:bg-violet-900/40 border border-violet-200" />
            <div className="w-3 h-3 rounded-sm bg-violet-200 dark:bg-violet-800/60 border border-violet-300" />
            <div className="w-3 h-3 rounded-sm bg-violet-400 dark:bg-violet-600" />
            <div className="w-3 h-3 rounded-sm bg-violet-600 dark:bg-violet-500" />
            <span>More</span>
            <span className="ml-3 text-muted-foreground/60">Click any day to filter transactions</span>
          </div>
        </div>
      </div>

      {/* Top spending days */}
      {Object.keys(dailySpend).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <h3 className="text-sm font-semibold mb-4">Top Spending Days</h3>
          <div className="space-y-2">
            {Object.entries(dailySpend)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([date, spend]) => {
                const pct = maxSpend > 0 ? (spend / maxSpend) * 100 : 0;
                return (
                  <button
                    key={date}
                    onClick={() => handleDayClick(date)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-foreground/80 group-hover:text-primary transition-colors">
                        {date}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {dailyCount[date]} txns
                        </span>
                        <span className="tabnum text-xs font-semibold text-expense">
                          {formatCurrency(spend)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-500 group-hover:bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
