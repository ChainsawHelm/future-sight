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
}

export function StatCard({
  title,
  value,
  format = 'currency',
  trend,
  subtitle,
  icon,
  className,
}: StatCardProps) {
  const formatted =
    format === 'currency'
      ? formatCurrency(value)
      : format === 'percent'
        ? `${(value * 100).toFixed(1)}%`
        : value.toLocaleString();

  const trendColor =
    trend === 'up' ? 'text-income' : trend === 'down' ? 'text-expense' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md', className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground/50">{icon}</div>}
      </div>
      <p className={cn('text-2xl font-bold tabnum', trendColor)}>
        {format === 'currency' && value < 0 ? '-' : ''}
        {format === 'currency' && value < 0 ? formatCurrency(Math.abs(value)) : formatted}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
