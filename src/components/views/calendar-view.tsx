'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { calendarApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/models';

export function CalendarView() {
  const { data, error, isLoading, refetch } = useFetch<{ events: CalendarEvent[] }>(() => calendarApi.list(), []);
  const [viewDate, setViewDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', amount: '', type: 'bill' as CalendarEvent['type'], recurring: '' });

  const createEvent = useMutation(useCallback((d: any) => calendarApi.create(d), []));
  const deleteEvent = useMutation(useCallback((id: string) => calendarApi.delete(id), []));

  const events = data?.events || [];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Group events by day
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  }

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

  const typeColors: Record<string, string> = {
    bill: 'bg-red-500', payday: 'bg-green-500', reminder: 'bg-blue-500', custom: 'bg-purple-500',
  };

  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  if (isLoading) return <PageLoader message="Loading calendar..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-navy-500 hover:bg-navy-600">{showAdd ? 'Cancel' : '+ Add Event'}</Button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-5 space-y-4 animate-slide-down">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Rent payment" /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
            <div><Label>Amount (optional)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div>
              <Label>Type</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className="flex h-10 w-full rounded-lg border bg-background px-3 text-sm">
                <option value="bill">Bill</option><option value="payday">Payday</option><option value="reminder">Reminder</option><option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="bg-navy-500 hover:bg-navy-600">Add Event</Button>
        </form>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h2 className="text-lg font-semibold">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r p-1.5 bg-muted/20" />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsByDay[day] || [];
            return (
              <div key={day} className={cn('min-h-[80px] border-b border-r p-1.5 transition-colors hover:bg-muted/10', isToday(day) && 'bg-navy-50 dark:bg-navy-900/20')}>
                <div className={cn('text-xs font-medium mb-1', isToday(day) ? 'text-navy-500 font-bold' : 'text-muted-foreground')}>
                  {day}
                </div>
                {dayEvents.map(e => (
                  <div key={e.id} className="flex items-center gap-1 mb-0.5 group">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', typeColors[e.type])} />
                    <span className="text-[10px] truncate flex-1">{e.title}</span>
                    <button onClick={async () => { await deleteEvent.mutate(e.id); refetch(); }}
                      className="hidden group-hover:block text-muted-foreground/40 hover:text-red-500">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
