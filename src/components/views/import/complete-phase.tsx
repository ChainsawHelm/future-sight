'use client';

import { Button } from '@/components/ui/button';
import type { ImportStats } from './import-reducer';

interface CompletePhaseProps {
  importResult: { count: number; files: { name: string; count: number }[] };
  stats: ImportStats;
  excludeDupes: boolean;
  sessionRulesCount: number;
  onReset: () => void;
}

export function CompletePhase({ importResult, stats, excludeDupes, sessionRulesCount, onReset }: CompletePhaseProps) {
  return (
    <div className="border border-border bg-surface-1 p-12 text-center">
      <div className="w-14 h-14 flex items-center justify-center mx-auto mb-5 bg-primary/10 text-primary border border-primary/30">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
      </div>
      <h2 className="text-xl font-bold mb-2">Import Complete</h2>
      <p className="ticker mb-3">{importResult.count} transaction{importResult.count !== 1 ? 's' : ''} imported</p>

      {importResult.files.length > 1 && (
        <div className="max-w-xs mx-auto mb-3 space-y-1 text-left">
          {importResult.files.map(f => (
            <div key={f.name} className="flex items-center justify-between gap-4 ticker text-[10px]">
              <span className="truncate">{f.name}</span>
              <span className="font-semibold shrink-0">{f.count} txns</span>
            </div>
          ))}
        </div>
      )}

      {stats.autoMatched > 0 && <p className="ticker text-primary mb-1">{stats.autoMatched} auto-categorized by merchant rules</p>}
      {stats.transfers > 0 && <p className="ticker text-purple-400 mb-1">{Math.floor(stats.transfers / 2)} transfer pairs detected</p>}
      {stats.duplicates > 0 && excludeDupes && <p className="ticker text-yellow-400 mb-1">{stats.duplicates} duplicates excluded</p>}
      {sessionRulesCount > 0 && <p className="ticker text-primary mb-1">{sessionRulesCount} new merchant rules saved</p>}

      <div className="flex gap-3 justify-center mt-6">
        <Button variant="outline" onClick={onReset}>Import Another</Button>
        <button onClick={() => window.location.href = '/transactions'}
          className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
          View Transactions
        </button>
      </div>
    </div>
  );
}
