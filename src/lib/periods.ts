/**
 * Shared period/timeline filtering used across Dashboard, Money Flow,
 * Transactions, and any other view that needs time-range selection.
 */

export type Period = 'today' | 'week' | 'month' | 'quarter' | 'half' | 'ytd' | `year:${number}`;

export const PERIOD_OPTIONS: Period[] = ['today', 'week', 'month', 'quarter', 'half', 'ytd'];

export const PERIOD_LABELS: Record<string, string> = {
  today:   'Today',
  week:    'This Week',
  month:   'This Month',
  quarter: 'This Quarter',
  half:    'This Half',
  ytd:     'Year to Date',
};

export function getPeriodLabel(period: Period): string {
  if (period.startsWith('year:')) return period.slice(5);
  return PERIOD_LABELS[period] || period;
}

export function getPeriodRange(period: Period): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (period) {
    case 'today': {
      const t = fmt(now);
      return { from: t, to: t };
    }
    case 'week': {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: fmt(start), to: fmt(end) };
    }
    case 'month':
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case 'quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { from: fmt(new Date(y, qStart, 1)), to: fmt(new Date(y, qStart + 3, 0)) };
    }
    case 'half': {
      const hStart = m < 6 ? 0 : 6;
      return { from: fmt(new Date(y, hStart, 1)), to: fmt(new Date(y, hStart + 6, 0)) };
    }
    case 'ytd':
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
    default:
      if (period.startsWith('year:')) {
        const yr = parseInt(period.slice(5));
        return { from: `${yr}-01-01`, to: `${yr}-12-31` };
      }
      return null;
  }
}

export function filterByPeriod<T extends { date: string }>(items: T[], period: Period): T[] {
  const range = getPeriodRange(period);
  if (!range) return items;
  return items.filter(t => t.date >= range.from && t.date <= range.to);
}

export function getTransactionYears(txns: { date: string }[]): number[] {
  const years = new Set<number>();
  for (const t of txns) {
    const yr = parseInt(t.date.slice(0, 4));
    if (!isNaN(yr)) years.add(yr);
  }
  return Array.from(years).sort((a, b) => b - a);
}
