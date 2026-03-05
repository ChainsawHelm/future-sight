'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { calendarApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/models';

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; dot: string; icon: string }> = {
  bill:        { label: 'Bill',        color: 'text-expense',  dot: 'bg-expense',     icon: '📄' },
  payday:      { label: 'Payday',      color: 'text-income',   dot: 'bg-income',      icon: '💰' },
  tax_return:  { label: 'Tax Return',  color: 'text-income',   dot: 'bg-emerald-400', icon: '🏛️' },
  inheritance: { label: 'Inheritance', color: 'text-primary',  dot: 'bg-primary',     icon: '🎁' },
  windfall:    { label: 'Windfall',    color: 'text-primary',  dot: 'bg-violet-400',  icon: '✨' },
  bonus:       { label: 'Bonus',       color: 'text-income',   dot: 'bg-green-400',   icon: '🎯' },
  reminder:    { label: 'Reminder',    color: 'text-info',     dot: 'bg-info',        icon: '🔔' },
  custom:      { label: 'Custom',      color: 'text-neutral',  dot: 'bg-neutral',     icon: '📌' },
};

export function CalendarView() {
  const router = useRouter();
  const { data, error, isLoading, refetch } = useFetch<{ events: CalendarEvent[] }>(
    () => calendarApi.list(), []
  );
  const [viewDate, setViewDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', date: '', amount: '', type: 'bill' as CalendarEvent['type'], recurring: '',
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Load transactions for the current month for spending dots
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd   = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
  const { data: txnData } = useFetch(
    () => transactionsApi.list({ dateFrom: monthStart, dateTo: monthEnd, limit: 500 }),
    [monthStart, monthEnd]
  );

  const createEvent = useMutation(useCallback((d: any) => calendarApi.create(d), []));
  const deleteEvent = useMutation(useCallback((id: string) => calendarApi.delete(id), []));

  const events = data?.events || [];
  const txns   = txnData?.transactions || [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Group events by day
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.date + 'T12:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  }

  // Group spending by day (for transaction dots)
  const spendByDay: Record<number, number> = {};
  const txnCountByDay: Record<number, number> = {};
  for (const t of txns) {
    if (t.amount < 0) {
      const day = parseInt(t.date.slice(8, 10), 10);
      spendByDay[day] = (spendByDay[day] || 0) + Math.abs(t.amount);
      txnCountByDay[day] = (txnCountByDay[day] || 0) + 1;
    }
  }
  const maxSpend = Object.values(spendByDay).length > 0 ? Math.max(...Object.values(spendByDay)) : 1;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createEvent.mutate({
      title: form.title,
      date: form.date,
      amount: form.amount ? parseFloat(form.amount) : undefined,
      type: form.type,
      recurring: form.recurring || undefined,
    });
    setForm({ title: '', date: '', amount: '', type: 'bill', recurring: '' });
    setShowAdd(false);
    refetch();
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    router.push(`/transactions?dateFrom=${dateStr}&dateTo=${dateStr}`);
  };

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const getSpendIntensity = (day: number) => {
    const spend = spendByDay[day];
    if (!spend) return '';
    const pct = spend / maxSpend;
    if (pct < 0.25) return 'bg-violet-50 dark:bg-violet-950/30';
    if (pct < 0.5)  return 'bg-violet-100 dark:bg-violet-900/30';
    if (pct < 0.75) return 'bg-violet-200/60 dark:bg-violet-800/30';
    return 'bg-violet-200 dark:bg-violet-700/30';
  };

  if (isLoading) return <PageLoader message="Loading calendar..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bills, income events, and spending — click any day to see transactions</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant={showAdd ? 'outline' : 'default'}>
          {showAdd ? 'Cancel' : '+ Add Event'}
        </Button>
      </div>

      {/* Add event form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card shadow-soft p-5 space-y-4 animate-slide-down">
          <h3 className="font-semibold text-sm">New Calendar Event</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Paycheck" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <Label>Amount (optional)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <Label>Event Type</Label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <optgroup label="Income Events">
                  <option value="payday">💰 Payday</option>
                  <option value="tax_return">🏛️ Tax Return</option>
                  <option value="bonus">🎯 Bonus</option>
                  <option value="inheritance">🎁 Inheritance</option>
                  <option value="windfall">✨ Windfall</option>
                </optgroup>
                <optgroup label="Expense Events">
                  <option value="bill">📄 Bill</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="reminder">🔔 Reminder</option>
                  <option value="custom">📌 Custom</option>
                </optgroup>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-44">
              <Label>Recurring</Label>
              <select
                value={form.recurring}
                onChange={e => setForm(f => ({ ...f, recurring: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <Button type="submit" className="mt-5">Add Event</Button>
          </div>
        </form>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h2 className="text-lg font-bold">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground border-b border-border bg-surface-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {/* Empty padding cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[88px] border-b border-r border-border/40 bg-surface-2/20" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsByDay[day] || [];
            const spend = spendByDay[day];
            const txnCount = txnCountByDay[day] || 0;
            const intensityClass = getSpendIntensity(day);

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={cn(
                  'min-h-[88px] border-b border-r border-border/40 p-1.5 text-left transition-all duration-150 cursor-pointer group',
                  'hover:ring-1 hover:ring-primary/40 hover:ring-inset',
                  isToday(day) && 'ring-1 ring-primary/30 ring-inset',
                  !isToday(day) && intensityClass
                )}
              >
                {/* Day number */}
                <div className={cn(
                  'text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full transition-colors',
                  isToday(day)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/60 group-hover:text-primary'
                )}>
                  {day}
                </div>

                {/* Spending dot + amount */}
                {spend && spend > 0 && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span className="text-[9px] font-mono text-expense/80 leading-tight">
                      {formatCurrency(spend)}
                    </span>
                    {txnCount > 1 && (
                      <span className="text-[8px] text-muted-foreground">×{txnCount}</span>
                    )}
                  </div>
                )}

                {/* Events */}
                {dayEvents.slice(0, 3).map(e => {
                  const cfg = EVENT_TYPE_CONFIG[e.type] || EVENT_TYPE_CONFIG.custom;
                  return (
                    <div key={e.id} className="flex items-center gap-1 mb-0.5 group/event">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                      <span className={cn('text-[9px] truncate flex-1 font-medium', cfg.color)}>
                        {cfg.icon} {e.title}
                        {e.amount ? ` · ${formatCurrency(e.amount)}` : ''}
                      </span>
                      <button
                        onClick={async (ev) => {
                          ev.stopPropagation();
                          await deleteEvent.mutate(e.id);
                          refetch();
                        }}
                        className="hidden group-hover/event:flex text-muted-foreground/30 hover:text-expense transition-colors"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[8px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/60">Legend:</span>
        {Object.entries(EVENT_TYPE_CONFIG).map(([, cfg]) => (
          <div key={cfg.label} className="flex items-center gap-1">
            <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            {cfg.icon} {cfg.label}
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          Spending activity
        </div>
      </div>
    </div>
  );
}
