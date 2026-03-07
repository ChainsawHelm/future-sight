'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import type { Category } from '@/types/models';
import type { MerchantGroup } from './import-reducer';

const QUICK_CATEGORIES = ['Dining', 'Groceries', 'Shopping', 'Gas', 'Entertainment', 'Subscriptions', 'Healthcare', 'Transportation'];

interface CategorizePhaseProps {
  merchant: MerchantGroup;
  queueIndex: number;
  queueTotal: number;
  categories: Category[];
  sessionRules: Map<string, string>;
  onCategorize: (merchant: string, category: string) => void;
  onSkip: () => void;
  onReset: () => void;
}

export function CategorizePhase({ merchant, queueIndex, queueTotal, categories, sessionRules, onCategorize, onSkip, onReset }: CategorizePhaseProps) {
  const [showAll, setShowAll] = useState(false);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');
  const quickCats = expenseCategories.filter(c => QUICK_CATEGORIES.includes(c.name));
  const otherExpenseCats = expenseCategories.filter(c => !QUICK_CATEGORIES.includes(c.name));

  const remaining = queueTotal - queueIndex;
  const progressPct = queueTotal > 0 ? Math.round(((queueIndex) / queueTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="border border-border bg-surface-1 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono font-semibold">
            {queueIndex + 1} of {queueTotal} merchants
          </p>
          <div className="flex items-center gap-3">
            {sessionRules.size > 0 && (
              <span className="ticker text-primary">{sessionRules.size} rule{sessionRules.size !== 1 ? 's' : ''} learned</span>
            )}
            <span className="ticker">{remaining} remaining</span>
          </div>
        </div>
        <div className="w-full h-1.5 bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Merchant Card */}
      <div className="border border-border bg-surface-1 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-lg font-mono font-bold">{merchant.merchant}</p>
            <p className="ticker mt-1">
              {merchant.count} transaction{merchant.count !== 1 ? 's' : ''} &middot; {merchant.dateRange[0]} to {merchant.dateRange[1]}
            </p>
          </div>
          <div className="text-right shrink-0">
            <Amount value={merchant.totalAmount} size="lg" showSign />
            {merchant.count > 1 && (
              <p className="ticker mt-0.5">avg <Amount value={merchant.avgAmount} size="sm" showSign /></p>
            )}
          </div>
        </div>

        <div className="border border-border/50 bg-surface-2/30 px-3 py-2 mb-5">
          <p className="ticker mb-0.5">Sample description</p>
          <p className="text-xs font-mono text-muted-foreground truncate">{merchant.sampleDescription}</p>
        </div>

        {/* Quick category buttons */}
        <p className="ticker mb-2">Choose a category</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {quickCats.map(c => (
            <button
              key={c.id}
              onClick={() => onCategorize(merchant.merchant, c.name)}
              className="h-8 px-4 text-xs font-mono font-semibold border border-border bg-surface-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Show more */}
        {!showAll ? (
          <button
            onClick={() => setShowAll(true)}
            className="ticker text-primary hover:text-primary/80 transition-colors"
          >
            Show all categories...
          </button>
        ) : (
          <div className="space-y-3 mt-3">
            {otherExpenseCats.length > 0 && (
              <div>
                <p className="ticker mb-1.5 text-muted-foreground/60">More Expense</p>
                <div className="flex flex-wrap gap-2">
                  {otherExpenseCats.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onCategorize(merchant.merchant, c.name)}
                      className="h-7 px-3 text-[11px] font-mono border border-border/60 bg-surface-2/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {incomeCategories.length > 0 && (
              <div>
                <p className="ticker mb-1.5 text-muted-foreground/60">Income</p>
                <div className="flex flex-wrap gap-2">
                  {incomeCategories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onCategorize(merchant.merchant, c.name)}
                      className="h-7 px-3 text-[11px] font-mono border border-border/60 bg-surface-2/50 hover:bg-income/20 hover:text-income hover:border-income/40 transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onReset}>Cancel Import</Button>
        <button
          onClick={onSkip}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
        >
          Skip &rarr;
        </button>
      </div>
    </div>
  );
}
