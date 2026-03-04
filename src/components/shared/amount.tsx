import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface AmountProps {
  value: number;
  className?: string;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Amount({ value, className, showSign = true, size = 'md' }: AmountProps) {
  const isPositive = value >= 0;
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span
      className={cn(
        'tabnum font-semibold',
        sizeClasses[size],
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
        className
      )}
    >
      {showSign && isPositive ? '+' : ''}
      {formatCurrency(value)}
    </span>
  );
}
