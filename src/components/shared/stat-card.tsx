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

  const accentColor =
    trend === 'up'
      ? 'hsl(var(--income))'
      : trend === 'down'
        ? 'hsl(var(--expense))'
        : 'hsl(var(--border))';

  const textColor =
    trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : 'text-foreground';

  return (
    <div
      className={cn(
        'relative bg-surface-1 border border-border rounded-[14px] overflow-hidden group',
        'hover:border-primary/20 transition-colors duration-200',
        'animate-fade-in',
        className
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Colored top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: accentColor, opacity: trend === 'neutral' ? 0.3 : 0.8 }}
      />

      {/* Corner decorative marks */}
      <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-[3px] opacity-30">
        <div className="h-px bg-foreground/40 w-4" />
        <div className="h-px bg-foreground/40 w-2.5" />
        <div className="h-px bg-foreground/40 w-1.5" />
      </div>

      {/* Index label — tiny number in top-left */}
      <div className="absolute top-3 left-3 text-[9px] font-mono text-muted-foreground/40 font-medium">
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Content */}
      <div className="pt-7 pb-4 px-4">
        {/* Title */}
        <p className="ticker mb-3">{title}</p>

        {/* Value */}
        <div className="flex items-baseline gap-1.5 mb-2">
          {isNegative && (
            <span className="numeral text-xl font-bold text-expense">−</span>
          )}
          <span className={cn('numeral text-2xl sm:text-[1.75rem] font-bold tabnum leading-none', textColor)}>
            {formatted}
          </span>
        </div>

        {/* Trend indicator */}
        <div className="flex items-center gap-2">
          {trend && trend !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm',
                trend === 'up'
                  ? 'bg-income/10 text-income'
                  : 'bg-expense/10 text-expense'
              )}
            >
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] text-muted-foreground font-mono">{subtitle}</span>
          )}
        </div>
      </div>
    </div>
  );
}
