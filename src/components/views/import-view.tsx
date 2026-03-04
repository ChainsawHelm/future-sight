'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useCategories } from '@/hooks/use-data';
import { transactionsApi, importApi, merchantRulesApi } from '@/lib/api-client';
import { processImport, type RawTransaction, type ProcessedTransaction } from '@/lib/import-engine';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import { formatDate, cn } from '@/lib/utils';
import type { ImportRecord } from '@/types/models';

type ImportPhase = 'upload' | 'review' | 'complete';

interface ImportStats { total: number; autoMatched: number; transfers: number; duplicates: number; }

export function ImportView() {
  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [processed, setProcessed] = useState<ProcessedTransaction[]>([]);
  const [stats, setStats] = useState<ImportStats>({ total: 0, autoMatched: 0, transfers: 0, duplicates: 0 });
  const [filename, setFilename] = useState('');
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const [parseError, setParseError] = useState('');
  const [excludeDupes, setExcludeDupes] = useState(true);

  const { data: categories } = useCategories();
  const { data: rulesData } = useFetch<{ rules: Record<string, string> }>(() => merchantRulesApi.list(), []);
  const { data: importsData, refetch: refetchImports } = useFetch<{ imports: ImportRecord[] }>(() => importApi.list(), []);
  const { data: recentTxns } = useFetch(() => transactionsApi.list({ limit: 200, sort: 'date', order: 'desc' }), []);

  const importMutation = useMutation(useCallback((data: any) => transactionsApi.bulkCreate(data), []));

  const parseCSV = (text: string): RawTransaction[] => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const findCol = (candidates: string[]) => { for (const c of candidates) { const i = headers.findIndex(h => h.includes(c)); if (i >= 0) return i; } return -1; };
    const dateIdx = findCol(['date', 'posted', 'transaction date', 'trans date']);
    const descIdx = findCol(['description', 'memo', 'merchant', 'name', 'payee', 'details']);
    const amtIdx = findCol(['amount', 'total']);
    const debitIdx = findCol(['debit', 'withdrawal']);
    const creditIdx = findCol(['credit', 'deposit']);
    const catIdx = findCol(['category', 'type', 'label']);
    const acctIdx = findCol(['account', 'account name']);
    if (dateIdx < 0 || descIdx < 0 || (amtIdx < 0 && debitIdx < 0)) return [];
    const rows: RawTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const fields: string[] = []; let current = ''; let inQuotes = false;
      for (const ch of lines[i]) { if (ch === '"') { inQuotes = !inQuotes; continue; } if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; } current += ch; }
      fields.push(current.trim());
      if (fields.length <= Math.max(dateIdx, descIdx)) continue;
      let amt = 0;
      if (amtIdx >= 0) { amt = parseFloat((fields[amtIdx] || '0').replace(/[$,]/g, '')) || 0; }
      else { const db = parseFloat((fields[debitIdx] || '0').replace(/[$,]/g, '')) || 0; const cr = creditIdx >= 0 ? parseFloat((fields[creditIdx] || '0').replace(/[$,]/g, '')) || 0 : 0; amt = cr > 0 ? cr : -db; }
      const date = fields[dateIdx] || ''; const desc = fields[descIdx] || '';
      if (!date || !desc) continue;
      rows.push({ date: normalizeDate(date), description: desc, amount: amt, category: (catIdx >= 0 && fields[catIdx]) || 'Uncategorized', account: (acctIdx >= 0 && fields[acctIdx]) || 'CSV Import' });
    }
    return rows;
  };

  const normalizeDate = (d: string): string => {
    const parts = d.split(/[\/\-]/);
    if (parts.length === 3) { let [a, b, c] = parts; if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`; if (c.length === 4) return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`; if (c.length === 2) { const yr = parseInt(c) > 50 ? `19${c}` : `20${c}`; return `${yr}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`; } }
    return d;
  };

  const [isParsing, setIsParsing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setParseError(''); setFilename(file.name);
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      // PDF: send to server for parsing
      setIsParsing(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) { setParseError(data.error || 'Failed to parse PDF'); setIsParsing(false); return; }
        if (data.transactions.length === 0) { setParseError('Could not extract transactions from PDF. Try exporting as CSV from your bank.'); setIsParsing(false); return; }
        const rules = rulesData?.rules || {};
        const existing = (recentTxns?.transactions || []).map((t: any) => ({ date: t.date, amount: t.amount, description: t.description }));
        const result = processImport(data.transactions, rules, existing);
        setProcessed(result.transactions); setStats(result.stats); setPhase('review');
      } catch (err: any) { setParseError(err.message || 'Failed to parse PDF'); }
      setIsParsing(false);
    } else {
      // CSV: parse client-side
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = parseCSV(ev.target?.result as string);
          if (raw.length === 0) { setParseError('Could not parse any transactions. Check CSV format.'); return; }
          const rules = rulesData?.rules || {};
          const existing = (recentTxns?.transactions || []).map((t: any) => ({ date: t.date, amount: t.amount, description: t.description }));
          const result = processImport(raw, rules, existing);
          setProcessed(result.transactions); setStats(result.stats); setPhase('review');
        } catch (err: any) { setParseError(err.message || 'Failed to parse file'); }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleCategoryChange = (idx: number, category: string) => {
    setProcessed(prev => { const next = [...prev]; next[idx] = { ...next[idx], category, autoMatched: false }; return next; });
  };

  const handleConfirmImport = async () => {
    const toImport = excludeDupes ? processed.filter(t => !t.flagged) : processed;
    const result = await importMutation.mutate({
      transactions: toImport.map(t => ({ date: t.date, description: t.description, originalDescription: t.originalDescription, amount: t.amount, category: t.category, account: t.account, autoMatched: t.autoMatched, flagged: false, transferPairId: t.transferPairId })),
      importRecord: { filename, sourceType: 'csv' },
    });
    if (result) { setImportResult({ count: result.created }); setPhase('complete'); refetchImports(); }
  };

  const handleDeleteImport = async (id: string) => { if (!confirm('Delete this import and all its transactions?')) return; await importApi.delete(id); refetchImports(); };
  const resetImport = () => { setPhase('upload'); setProcessed([]); setStats({ total: 0, autoMatched: 0, transfers: 0, duplicates: 0 }); setFilename(''); setImportResult(null); setParseError(''); };
  const importCount = excludeDupes ? processed.filter(t => !t.flagged).length : processed.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold">Import</h1><p className="text-sm text-muted-foreground mt-1">Import transactions from bank statements</p></div>

      {phase === 'upload' && (
        <div className="space-y-6">
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-card p-12 text-center hover:border-navy-300 transition-colors">
            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" /></svg>
            </div>
            <p className="text-sm font-medium mb-1">Drop a CSV or PDF file here or click to browse</p>
            <p className="text-xs text-muted-foreground mb-4">Supports CSV bank exports and PDF statements. Auto-categorizes via merchant rules.</p>
            <label className="inline-block">
              <input type="file" accept=".csv,.txt,.pdf" onChange={handleFileUpload} className="hidden" disabled={isParsing} />
              <span className={cn('inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors',
                isParsing ? 'bg-navy-400 text-white/70 cursor-wait' : 'bg-navy-500 text-white hover:bg-navy-600'
              )}>
                {isParsing ? 'Parsing PDF...' : 'Choose File'}
              </span>
            </label>
          </div>
          {parseError && <ErrorAlert message={parseError} />}
          {importsData?.imports && importsData.imports.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Import History</h2>
              <div className="space-y-2">
                {importsData.imports.map(imp => (
                  <div key={imp.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                    <div><p className="text-sm font-medium">{imp.filename}</p><p className="text-xs text-muted-foreground">{imp.transactionCount} transactions · {formatDate(imp.importedAt)}</p></div>
                    <button onClick={() => handleDeleteImport(imp.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center"><p className="text-lg font-bold tabnum">{stats.total}</p><p className="text-[11px] text-muted-foreground">Total Parsed</p></div>
            <div className="rounded-lg border bg-card p-3 text-center"><p className="text-lg font-bold tabnum text-green-600">{stats.autoMatched}</p><p className="text-[11px] text-muted-foreground">Auto-Categorized</p></div>
            <div className="rounded-lg border bg-card p-3 text-center"><p className="text-lg font-bold tabnum text-purple-600">{stats.transfers}</p><p className="text-[11px] text-muted-foreground">Transfer Pairs</p></div>
            <div className="rounded-lg border bg-card p-3 text-center"><p className="text-lg font-bold tabnum text-yellow-600">{stats.duplicates}</p><p className="text-[11px] text-muted-foreground">Duplicates</p></div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium">{filename}</p>
              {stats.duplicates > 0 && (
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={excludeDupes} onChange={e => setExcludeDupes(e.target.checked)} className="rounded" />Exclude {stats.duplicates} duplicate{stats.duplicates !== 1 ? 's' : ''}</label>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetImport}>Cancel</Button>
              <Button size="sm" onClick={handleConfirmImport} disabled={importMutation.isLoading} className="bg-navy-500 hover:bg-navy-600">{importMutation.isLoading ? 'Importing...' : `Import ${importCount} Transactions`}</Button>
            </div>
          </div>
          {importMutation.error && <ErrorAlert message={importMutation.error} />}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur"><tr className="border-b">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-16">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Account</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                </tr></thead>
                <tbody>
                  {processed.map((row, i) => (
                    <tr key={i} className={cn('border-b last:border-0 hover:bg-muted/10', row.flagged && 'bg-yellow-50/50 dark:bg-yellow-900/10 opacity-60', row.transferPairId && !row.flagged && 'bg-purple-50/30 dark:bg-purple-900/10')}>
                      <td className="px-3 py-2 text-[10px]">
                        {row.flagged ? <span className="text-yellow-600" title="Potential duplicate">⚠ Dupe</span> : row.transferPairId ? <span className="text-purple-600" title="Transfer pair">⇄ Xfer</span> : row.autoMatched ? <span className="text-green-600" title="Auto-matched">✓ Auto</span> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground tabnum whitespace-nowrap">{row.date}</td>
                      <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={row.originalDescription}>{row.description}</td>
                      <td className="px-3 py-2">
                        <select value={row.category} onChange={e => handleCategoryChange(i, e.target.value)} className="h-7 rounded border bg-background px-2 text-xs w-full max-w-[160px]">
                          {categories?.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.account}</td>
                      <td className="px-3 py-2 text-right"><Amount value={row.amount} size="sm" showSign /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {phase === 'complete' && importResult && (
        <div className="rounded-xl border bg-card p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600"><path d="M20 6L9 17l-5-5" /></svg></div>
          <h2 className="text-xl font-bold mb-2">Import Complete</h2>
          <p className="text-sm text-muted-foreground mb-2">{importResult.count} transaction{importResult.count !== 1 ? 's' : ''} imported from {filename}</p>
          {stats.autoMatched > 0 && <p className="text-xs text-green-600 mb-1">{stats.autoMatched} auto-categorized by merchant rules</p>}
          {stats.transfers > 0 && <p className="text-xs text-purple-600 mb-1">{Math.floor(stats.transfers / 2)} transfer pairs detected</p>}
          {stats.duplicates > 0 && excludeDupes && <p className="text-xs text-yellow-600 mb-1">{stats.duplicates} duplicates excluded</p>}
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="outline" onClick={resetImport}>Import Another</Button>
            <Button className="bg-navy-500 hover:bg-navy-600" onClick={() => window.location.href = '/transactions'}>View Transactions</Button>
          </div>
        </div>
      )}
    </div>
  );
}
