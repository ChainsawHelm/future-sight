import { cn } from '@/lib/utils';

// Color map matching the original app
const CAT_COLORS: Record<string, string> = {
  'Housing': '#4F6D7A',
  'Transportation': '#C0D6DF',
  'Groceries': '#16A34A',
  'Restaurants': '#EA580C',
  'Food & Dining': '#DB6C35',
  'Subscriptions': '#8B5CF6',
  'Utilities': '#059669',
  'Insurance': '#0284C7',
  'Shopping': '#E11D48',
  'Entertainment': '#D946EF',
  'Healthcare': '#DC2626',
  'Personal Care': '#F472B6',
  'Education': '#4338CA',
  'Gifts & Donations': '#C026D3',
  'Travel': '#0891B2',
  'Fees & Charges': '#78716C',
  'Other Expenses': '#A3A3A3',
  'Income': '#16A34A',
  'Salary': '#15803D',
  'Freelance': '#22C55E',
  'Investments': '#059669',
  'Rental Income': '#0D9488',
  'Side Hustle': '#10B981',
  'Other Income': '#34D399',
  'Transfers': '#8B5CF6',
  'Debt Payments': '#F59E0B',
  'Savings': '#0EA5E9',
  'Refunds': '#6366F1',
  'Returns': '#818CF8',
  'Uncategorized': '#9CA3AF',
};

export function getCategoryColor(category: string): string {
  return CAT_COLORS[category] || '#9CA3AF';
}

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function CategoryBadge({ category, size = 'sm', className }: CategoryBadgeProps) {
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      <span
        className={cn('rounded-full shrink-0', dotSize)}
        style={{ backgroundColor: getCategoryColor(category) }}
      />
      {category}
    </span>
  );
}

interface CategoryDotProps {
  category: string;
  size?: number;
}

export function CategoryDot({ category, size = 8 }: CategoryDotProps) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: getCategoryColor(category),
      }}
    />
  );
}
