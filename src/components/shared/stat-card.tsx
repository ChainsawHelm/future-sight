import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  prefix?: string;
  format?: 'currency' | 'number' | 'percent';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  delta?: number;
}

export function StatCard({
  title,
  value,
  format = 'currency',
  trend,
  subtitle,
  icon,
  className,
  delta,
}: StatCardProps) {
  const formatted =
    format === 'currency'
      ? formatCurrency(Math.abs(value))
      : format === 'percent'
        ? `${(value * 100).toFixed(1)}%`
        : value.toLocaleString();

  const isNegative = format === 'currency' && value < 0;

  const valueColor =
    trend === 'up'
      ? 'text-income'
      : trend === 'down'
        ? 'text-expense'
        : 'text-foreground';

  const TrendIcon = ({ dir }: { dir: 'up' | 'down' }) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'up'
        ? <path d="M7 17L17 7M17 7H7M17 7v10" />
        : <path d="M7 7l10 10M17 17H7M17 17V7" />}
    </svg>
  );

  return (
    <div className={cn(
      'relative border border-border bg-card p-4 transition-colors hover:border-primary/20 hover:bg-card/80 group',
      className
    )}>
      {/* Top bar accent line on hover */}
      <div className="absolute top-0 left-0 right-0 h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />

      <div className="flex items-start justify-between mb-3">
        <p className="ticker-label">{title}</p>
        {icon && (
          <div className="text-muted-foreground/30 group-hover:text-primary/40 transition-colors">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        {isNegative && (
          <span className="mono-num text-xl font-semibold text-expense">−</span>
        )}
        <span className={cn('mono-num text-2xl font-semibold tabnum tracking-tight leading-none', valueColor)}>
          {formatted}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {trend && trend !== 'neutral' && (
          <span className={cn(
            'flex items-center gap-0.5 text-[10px] font-medium',
            trend === 'up' ? 'text-income' : 'text-expense'
          )}>
            <TrendIcon dir={trend} />
          </span>
        )}
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
        {delta !== undefined && (
          <span className={cn(
            'ml-auto mono-num text-[10px] font-medium',
            delta >= 0 ? 'text-income' : 'text-expense'
          )}>
            {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
          </span>
        )}
      </div>
    </div>
  );
}
