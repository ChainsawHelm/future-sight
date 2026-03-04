'use client';

import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, cn } from '@/lib/utils';

export function HeatmapView() {
  const { data, error, isLoading, refetch } = useFetch(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'desc' }), []
  );

  const txns = data?.transactions || [];

  if (isLoading) return <PageLoader message="Loading heatmap..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (txns.length === 0) return <EmptyState title="No data" description="Import transactions to see the heatmap." />;

  // Group spending by day
  const dailySpend: Record<string, number> = {};
  for (const t of txns) {
    if (t.amount < 0) {
      dailySpend[t.date] = (dailySpend[t.date] || 0) + Math.abs(t.amount);
    }
  }

  const values = Object.values(dailySpend);
  const maxSpend = values.length > 0 ? Math.max(...values) : 1;

  // Generate last 365 days
  const days: { date: string; spend: number; dayOfWeek: number }[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, spend: dailySpend[dateStr] || 0, dayOfWeek: d.getDay() });
  }

  // Group into weeks
  const weeks: typeof days[] = [];
  let currentWeek: typeof days = [];
  // Pad first week
  if (days[0].dayOfWeek > 0) {
    for (let i = 0; i < days[0].dayOfWeek; i++) currentWeek.push({ date: '', spend: 0, dayOfWeek: i });
  }
  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length) weeks.push(currentWeek);

  const getColor = (spend: number): string => {
    if (spend === 0) return 'bg-muted';
    const intensity = spend / maxSpend;
    if (intensity < 0.25) return 'bg-green-200 dark:bg-green-900';
    if (intensity < 0.5) return 'bg-yellow-300 dark:bg-yellow-800';
    if (intensity < 0.75) return 'bg-orange-400 dark:bg-orange-700';
    return 'bg-red-500 dark:bg-red-600';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Spending Heatmap</h1>
        <p className="text-sm text-muted-foreground mt-1">Daily spending intensity over the past year</p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm overflow-x-auto">
        <div className="flex gap-1 min-w-[700px]">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-2 pt-0">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
              <div key={i} className="h-3 text-[9px] text-muted-foreground flex items-center">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={cn('w-3 h-3 rounded-[2px] transition-colors', day.date ? getColor(day.spend) : 'bg-transparent')}
                  title={day.date ? `${day.date}: ${formatCurrency(day.spend)}` : ''}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[2px] bg-muted" />
          <div className="w-3 h-3 rounded-[2px] bg-green-200 dark:bg-green-900" />
          <div className="w-3 h-3 rounded-[2px] bg-yellow-300 dark:bg-yellow-800" />
          <div className="w-3 h-3 rounded-[2px] bg-orange-400 dark:bg-orange-700" />
          <div className="w-3 h-3 rounded-[2px] bg-red-500 dark:bg-red-600" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
