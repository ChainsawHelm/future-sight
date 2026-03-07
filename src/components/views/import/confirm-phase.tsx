'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/shared/error-alert';
import type { Category } from '@/types/models';
import type { ImportStats, MerchantGroup } from './import-reducer';

interface ConfirmPhaseProps {
  stats: ImportStats;
  merchantMap: Map<string, MerchantGroup>;
  excludeDupes: boolean;
  importCount: number;
  isImporting: boolean;
  error: string | null;
  sessionRulesCount: number;
  categories: Category[];
  onToggleDupes: () => void;
  onReassign: (merchant: string, category: string) => void;
  onCreateCategory: (name: string) => Promise<void>;
  onConfirm: () => void;
  onReset: () => void;
}

export function ConfirmPhase({ stats, merchantMap, excludeDupes, importCount, isImporting, error, sessionRulesCount, categories, onToggleDupes, onReassign, onCreateCategory, onConfirm, onReset }: ConfirmPhaseProps) {
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');

  const groups = Array.from(merchantMap.values());

  // Group merchants by category
  const byCategory = new Map<string, MerchantGroup[]>();
  for (const g of groups) {
    const list = byCategory.get(g.category) || [];
    list.push(g);
    byCategory.set(g.category, list);
  }

  // Sort categories: most merchants first, but put Transfer/Income at the end
  const categoryOrder = useMemo(() => {
    const order = Array.from(byCategory.entries())
      .sort((a, b) => {
        const aSpecial = a[0] === 'Transfer' || a[0] === 'Income';
        const bSpecial = b[0] === 'Transfer' || b[0] === 'Income';
        if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
        return b[1].length - a[1].length;
      });
    for (const [, merchants] of order) {
      merchants.sort((a, b) => b.count - a.count);
    }
    return order;
  }, [byCategory]);

  // Start all collapsed
  const allCats = useMemo(() => new Set(categoryOrder.map(([cat]) => cat)), [categoryOrder]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const totalAmount = groups.reduce((s, g) => s + g.totalAmount, 0);
  const income = groups.filter(g => g.totalAmount > 0).reduce((s, g) => s + g.totalAmount, 0);
  const expenses = groups.filter(g => g.totalAmount < 0).reduce((s, g) => s + Math.abs(g.totalAmount), 0);

  const toggleGroup = (cat: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const allExpanded = expandedGroups.size === allCats.size;
  const toggleAll = () => {
    setExpandedGroups(allExpanded ? new Set() : new Set(allCats));
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="border border-border bg-surface-1 p-5">
        <p className="ticker mb-3">Import Summary</p>
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

        <div className="flex items-center justify-between">
          <p className="ticker text-muted-foreground/70 text-[10px]">
            {categoryOrder.length} categories · {groups.length} merchants — click to expand, click merchant to reassign
          </p>
          <button onClick={toggleAll} className="ticker text-[10px] text-primary hover:text-primary/80 transition-colors">
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* Grouped merchants by category */}
      {categoryOrder.map(([cat, merchants]) => {
        const catTotal = merchants.reduce((s, g) => s + g.totalAmount, 0);
        const catCount = merchants.reduce((s, g) => s + g.count, 0);
        const isExpanded = expandedGroups.has(cat);

        return (
          <div key={cat} className="border border-border bg-surface-1 overflow-hidden">
            {/* Category header — clickable to expand/collapse */}
            <button
              onClick={() => toggleGroup(cat)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-surface-2/80 transition-colors text-left',
                isExpanded && 'border-b border-border'
              )}
            >
              <div className="flex items-center gap-2">
                <svg
                  width="10" height="10" viewBox="0 0 10 10"
                  className={cn('text-muted-foreground transition-transform', isExpanded ? 'rotate-90' : '')}
                >
                  <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span className={cn(
                  'text-sm font-mono font-semibold',
                  cat === 'Transfer' ? 'text-purple-400' : cat === 'Income' ? 'text-income' : 'text-foreground'
                )}>{cat}</span>
                <span className="ticker text-[10px]">{merchants.length} merchant{merchants.length !== 1 ? 's' : ''} · {catCount} txn{catCount !== 1 ? 's' : ''}</span>
              </div>
              <Amount value={catTotal} size="sm" showSign />
            </button>

            {/* Merchant list */}
            {isExpanded && (
              <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
                {merchants.map(m => (
                  <div key={m.merchant} className="group relative">
                    {reassigning === m.merchant ? (
                      /* Reassign mode: show category buttons */
                      <div className="px-4 py-3 bg-surface-2/30">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-mono font-semibold">{m.merchant}</p>
                          <button
                            onClick={() => setReassigning(null)}
                            className="ticker text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {expenseCategories.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { onReassign(m.merchant, c.name); setReassigning(null); }}
                              className={cn(
                                'h-6 px-2.5 text-[10px] font-mono border transition-colors',
                                c.name === m.category
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border/60 bg-surface-2/50 hover:bg-primary hover:text-primary-foreground hover:border-primary'
                              )}
                            >
                              {c.name}
                            </button>
                          ))}
                          {incomeCategories.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { onReassign(m.merchant, c.name); setReassigning(null); }}
                              className={cn(
                                'h-6 px-2.5 text-[10px] font-mono border transition-colors',
                                c.name === m.category
                                  ? 'border-income bg-income/20 text-income'
                                  : 'border-border/60 bg-surface-2/50 hover:bg-income/20 hover:text-income hover:border-income/40'
                              )}
                            >
                              {c.name}
                            </button>
                          ))}
                          {/* Custom category */}
                          {creatingCustom ? (
                            <form
                              className="flex items-center gap-1"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const name = customName.trim();
                                if (!name) return;
                                await onCreateCategory(name);
                                onReassign(m.merchant, name);
                                setCreatingCustom(false);
                                setCustomName('');
                                setReassigning(null);
                              }}
                            >
                              <input
                                autoFocus
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                placeholder="Category name"
                                className="h-6 px-2 text-[10px] font-mono bg-surface-3 border border-border/60 text-foreground outline-none focus:border-primary w-28"
                              />
                              <button
                                type="submit"
                                className="h-6 px-2 text-[10px] font-mono border border-primary bg-primary text-primary-foreground"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => { setCreatingCustom(false); setCustomName(''); }}
                                className="h-6 px-2 text-[10px] font-mono border border-border/60 bg-surface-2/50 text-muted-foreground hover:text-foreground"
                              >
                                x
                              </button>
                            </form>
                          ) : (
                            <button
                              onClick={() => setCreatingCustom(true)}
                              className="h-6 px-2.5 text-[10px] font-mono border border-dashed border-border/60 bg-surface-2/30 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                            >
                              + Custom
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Normal row: clickable to reassign */
                      <button
                        onClick={() => setReassigning(m.merchant)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-2/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono truncate">{m.merchant}</span>
                          <span className="ticker text-[10px] shrink-0">{m.count} txn{m.count !== 1 ? 's' : ''}</span>
                          {!m.autoMatched && (
                            <span className="ticker text-[9px] text-yellow-400/70 shrink-0">guessed</span>
                          )}
                        </div>
                        <Amount value={m.totalAmount} size="sm" showSign />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Warnings & toggles */}
      {stats.duplicates > 0 && (
        <label className="flex items-center gap-2 ticker cursor-pointer">
          <input type="checkbox" checked={excludeDupes} onChange={onToggleDupes} className="accent-primary" />
          Exclude {stats.duplicates} duplicate{stats.duplicates !== 1 ? 's' : ''}
        </label>
      )}

      {sessionRulesCount > 0 && (
        <p className="ticker text-primary">{sessionRulesCount} merchant rule{sessionRulesCount !== 1 ? 's' : ''} saved for future imports</p>
      )}

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
