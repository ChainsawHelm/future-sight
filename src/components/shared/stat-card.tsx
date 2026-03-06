import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  format?: 'currency' | 'number' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  index?: number;
}

export function StatCard({
  title,
  value,
  format = 'currency',
  trend,
  subtitle,
  className,
  index = 0,
}: StatCardProps) {
  const absValue = Math.abs(value);
  const formatted =
    format === 'currency'
      ? formatCurrency(absValue)
      : format === 'percent'
        ? `${(value * 100).toFixed(1)}%`
        : value.toLocaleString();

  const isNegative = format === 'currency' && value < 0;

  const textColor =
    trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : 'text-foreground';

  const borderColor =
    trend === 'up'
      ? 'border-income/30'
      : trend === 'down'
        ? 'border-expense/30'
        : 'border-border';

  return (
    <div
      className={cn(
        'relative bg-surface-1 border overflow-hidden font-mono',
        borderColor,
        'hover:border-primary/25 transition-colors duration-150',
        'animate-fade-in',
        className
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Terminal window header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-2">
        <span className="text-[9px] tracking-[0.12em] uppercase text-primary/50">
          [{String(index + 1).padStart(2, '0')}] {title}
        </span>
        <span className="text-[8px] text-muted-foreground/40">
          {trend === 'up' ? '[+]' : trend === 'down' ? '[-]' : '[=]'}
        </span>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Value */}
        <div className="flex items-baseline gap-1 mb-1.5">
          {isNegative && (
            <span className="numeral text-lg font-bold text-expense">-</span>
          )}
          <span className={cn('numeral text-xl sm:text-2xl font-bold tabnum leading-none', textColor)}>
            {formatted}
          </span>
        </div>

        {/* Trend + subtitle */}
        <div className="flex items-center gap-2">
          {trend && trend !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1 py-0.5 border',
                trend === 'up'
                  ? 'bg-income/8 text-income border-income/20'
                  : 'bg-expense/8 text-expense border-expense/20'
              )}
            >
              {trend === 'up' ? '++' : '--'}
            </span>
          )}
          {subtitle && (
            <span className="text-[10px] text-muted-foreground font-mono">{subtitle}</span>
          )}
        </div>
      </div>
    </div>
  );
}
