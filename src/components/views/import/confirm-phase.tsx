'use client';

import { cn } from '@/lib/utils';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/shared/error-alert';
import type { ImportStats, MerchantGroup } from './import-reducer';

interface ConfirmPhaseProps {
  stats: ImportStats;
  merchantMap: Map<string, MerchantGroup>;
  excludeDupes: boolean;
  importCount: number;
  isImporting: boolean;
  error: string | null;
  sessionRulesCount: number;
  onToggleDupes: () => void;
  onConfirm: () => void;
  onReset: () => void;
}

export function ConfirmPhase({ stats, merchantMap, excludeDupes, importCount, isImporting, error, sessionRulesCount, onToggleDupes, onConfirm, onReset }: ConfirmPhaseProps) {
  const groups = Array.from(merchantMap.values());

  // Category breakdown
  const categoryTotals = new Map<string, { count: number; amount: number }>();
  for (const g of groups) {
    const existing = categoryTotals.get(g.category) || { count: 0, amount: 0 };
    existing.count += g.count;
    existing.amount += g.totalAmount;
    categoryTotals.set(g.category, existing);
  }
  const categoryList = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const totalAmount = groups.reduce((s, g) => s + g.totalAmount, 0);
  const income = groups.filter(g => g.totalAmount > 0).reduce((s, g) => s + g.totalAmount, 0);
  const expenses = groups.filter(g => g.totalAmount < 0).reduce((s, g) => s + Math.abs(g.totalAmount), 0);
  const uncategorized = groups.filter(g => g.category === 'Uncategorized');

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface-1 p-5">
        <p className="ticker mb-3">Import Summary</p>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border border-border px-3 py-2.5">
            <p className="ticker mb-1">Income</p>
            <p className="numeral font-bold text-lg tabnum text-income">+${income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="border border-border px-3 py-2.5">
            <p className="ticker mb-1">Expenses</p>
            <p className="numeral font-bold text-lg tabnum text-expense">-${expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="border border-border px-3 py-2.5">
            <p className="ticker mb-1">Net</p>
            <p className={cn('numeral font-bold text-lg tabnum', totalAmount >= 0 ? 'text-income' : 'text-expense')}>
              {totalAmount >= 0 ? '+' : '-'}${Math.abs(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="border border-border overflow-hidden mb-4">
          <div className="px-3 py-2 bg-surface-2 border-b border-border">
            <p className="ticker">By Category</p>
          </div>
          <div className="divide-y divide-border max-h-[250px] overflow-y-auto">
            {categoryList.map(([cat, data]) => (
              <div key={cat} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs font-mono',
                    cat === 'Uncategorized' ? 'text-yellow-400' : cat === 'Transfer' ? 'text-purple-400' : 'text-foreground'
                  )}>{cat}</span>
                  <span className="ticker text-[10px]">{data.count} txn{data.count !== 1 ? 's' : ''}</span>
                </div>
                <Amount value={data.amount} size="sm" showSign />
              </div>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {uncategorized.length > 0 && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5 mb-3">
            <p className="ticker text-yellow-400">
              {uncategorized.reduce((s, g) => s + g.count, 0)} transaction{uncategorized.reduce((s, g) => s + g.count, 0) !== 1 ? 's' : ''} still uncategorized (will import as "Uncategorized")
            </p>
          </div>
        )}

        {stats.duplicates > 0 && (
          <label className="flex items-center gap-2 ticker cursor-pointer mb-3">
            <input type="checkbox" checked={excludeDupes} onChange={onToggleDupes} className="accent-primary" />
            Exclude {stats.duplicates} duplicate{stats.duplicates !== 1 ? 's' : ''}
          </label>
        )}

        {sessionRulesCount > 0 && (
          <p className="ticker text-primary mb-3">{sessionRulesCount} merchant rule{sessionRulesCount !== 1 ? 's' : ''} saved for future imports</p>
        )}
      </div>

      {error && <ErrorAlert message={error} />}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>Cancel</Button>
        <button
          onClick={onConfirm}
          disabled={isImporting}
          className="h-9 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
        >
          {isImporting ? 'Importing...' : `Import ${importCount} Transactions`}
        </button>
      </div>
    </div>
  );
}
