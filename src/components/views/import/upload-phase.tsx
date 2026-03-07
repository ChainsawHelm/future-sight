'use client';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { PlaidAccounts } from '@/components/plaid/plaid-accounts';
import { ErrorAlert } from '@/components/shared/error-alert';
import type { FileQueueItem } from './import-reducer';
import type { ImportRecord } from '@/types/models';

interface UploadPhaseProps {
  fileQueue: FileQueueItem[];
  isParsing: boolean;
  parseError: string;
  imports: ImportRecord[] | undefined;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteImport: (id: string) => void;
  onRefetchImports: () => void;
}

export function UploadPhase({ fileQueue, isParsing, parseError, imports, onFileUpload, onDeleteImport, onRefetchImports }: UploadPhaseProps) {
  return (
    <div className="space-y-4">
      <PlaidAccounts onSync={onRefetchImports} />

      <div className="border border-border bg-surface-1 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-0.5">Bank Connection</p>
            <h2 className="text-sm font-semibold">Connect Your Bank</h2>
            <p className="ticker mt-0.5">Automatically import transactions via Plaid</p>
          </div>
          <PlaidLinkButton onSuccess={() => window.location.reload()} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="ticker">or upload manually</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="border border-dashed border-border bg-surface-1 p-10 text-center hover:border-primary/40 transition-colors">
        <div className="mx-auto w-12 h-12 flex items-center justify-center mb-4 border border-border bg-surface-2 text-muted-foreground">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>
        </div>
        <p className="text-sm font-semibold mb-1">Drop files here or click to browse</p>
        <p className="ticker mb-1">Supports CSV and PDF — select multiple files at once</p>
        <p className="ticker mb-5 text-[10px]">Transactions are auto-categorized by merchant rules. You only review what couldn&apos;t be matched.</p>
        <label className="inline-block">
          <input type="file" accept=".csv,.txt,.pdf" onChange={onFileUpload} className="hidden" disabled={isParsing} multiple />
          <span className={cn(
            'inline-flex items-center h-9 px-5 text-sm font-semibold cursor-pointer transition-colors',
            isParsing
              ? 'bg-primary/40 text-primary-foreground cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
          )}>
            {isParsing ? 'Processing...' : 'Choose Files'}
          </span>
        </label>
      </div>

      {fileQueue.length > 0 && (
        <div className="border border-border bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="ticker">Processing Queue</p>
          </div>
          <div className="divide-y divide-border">
            {fileQueue.map(f => (
              <div key={f.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn('w-4 h-4 flex items-center justify-center text-[10px] shrink-0',
                  f.status === 'done' ? 'text-income'
                  : f.status === 'error' ? 'text-expense'
                  : f.status === 'parsing' ? 'text-primary'
                  : 'text-muted-foreground/30'
                )}>
                  {f.status === 'done' ? '✓' : f.status === 'error' ? '✕' : f.status === 'parsing' ? '…' : '○'}
                </span>
                <p className="text-xs font-mono flex-1 truncate">{f.name}</p>
                <p className="ticker text-[10px] shrink-0">
                  {f.status === 'done' ? `${f.count} transactions`
                   : f.status === 'error' ? f.error
                   : f.status === 'parsing' ? 'Parsing...'
                   : 'Pending'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {parseError && <ErrorAlert message={parseError} />}

      {imports && imports.length > 0 && (
        <div className="border border-border bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="ticker">Import History</p>
          </div>
          <div className="divide-y divide-border">
            {imports.map(imp => (
              <div key={imp.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2/60 transition-colors">
                <div>
                  <p className="text-sm font-medium">{imp.filename}</p>
                  <p className="ticker">{imp.transactionCount} transactions · {formatDate(imp.importedAt)}</p>
                </div>
                <button onClick={() => onDeleteImport(imp.id)} className="text-muted-foreground/30 hover:text-expense transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
