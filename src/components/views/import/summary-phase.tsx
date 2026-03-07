'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ImportStats, MerchantGroup, FileGroup } from './import-reducer';

interface SummaryPhaseProps {
  stats: ImportStats;
  merchantMap: Map<string, MerchantGroup>;
  uncategorizedCount: number;
  fileGroups: FileGroup[];
  sessionRulesCount: number;
  onProceed: () => void;
  onReset: () => void;
}

export function SummaryPhase({ stats, merchantMap, uncategorizedCount, fileGroups, sessionRulesCount, onProceed, onReset }: SummaryPhaseProps) {
  const categorizedCount = stats.total - uncategorizedCount - stats.duplicates;
  const categorizedPct = stats.total > 0 ? Math.round((categorizedCount / stats.total) * 100) : 0;
  const merchantCount = merchantMap.size;

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface-1 p-6">
        <p className="ticker mb-2">Auto-Categorization Results</p>
        <div className="flex items-end gap-3 mb-4">
          <p className="text-3xl font-bold tabnum">{categorizedPct}%</p>
          <p className="ticker mb-1">auto-categorized</p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-surface-2 overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-700"
            style={{ width: `${categorizedPct}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Parsed', value: stats.total, color: 'text-foreground' },
            { label: 'Auto-Categorized', value: categorizedCount, color: 'text-primary' },
            { label: 'Transfers', value: stats.transfers, color: 'text-purple-400' },
            { label: 'Duplicates', value: stats.duplicates, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="border border-border px-3 py-2.5">
              <p className="ticker mb-1">{s.label}</p>
              <p className={cn('numeral font-bold text-lg tabnum', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Merchant summary */}
      <div className="border border-border bg-surface-1 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="ticker">{merchantCount} unique merchants found</p>
          {sessionRulesCount > 0 && (
            <span className="ticker text-[10px] text-primary">{sessionRulesCount} rules saved</span>
          )}
        </div>

        <div className="border border-primary/30 bg-primary/5 px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-primary">All merchants categorized</p>
          <p className="ticker text-primary/70">Review merchants grouped by category on the next screen — fix any that don&apos;t belong.</p>
        </div>

        {fileGroups.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {fileGroups.map(g => (
              <span key={g.filename} className="ticker text-[9px] px-1.5 py-0.5 bg-surface-3 border border-border">{g.filename} ({g.count})</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>Cancel</Button>
        <button
          onClick={onProceed}
          className="h-9 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
        >
          Review & Import
        </button>
      </div>
    </div>
  );
}
