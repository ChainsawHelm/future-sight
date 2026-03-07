'use client';

import { useReducer, useCallback, useState } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useCategories } from '@/hooks/use-data';
import { transactionsApi, importApi, merchantRulesApi } from '@/lib/api-client';
import { processImport, type RawTransaction, type ProcessedTransaction } from '@/lib/import-engine';
import type { ImportRecord } from '@/types/models';
import { importReducer, initialState, deriveFinalTransactions, type FileGroup } from './import-reducer';
import { UploadPhase } from './upload-phase';
import { SummaryPhase } from './summary-phase';
import { CategorizePhase } from './categorize-phase';
import { ConfirmPhase } from './confirm-phase';
import { CompletePhase } from './complete-phase';

export function ImportView() {
  const [state, dispatch] = useReducer(importReducer, initialState);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  const { data: categories } = useCategories();
  const { data: rulesData } = useFetch<{ rules: Record<string, string> }>(() => merchantRulesApi.list(), []);
  const { data: importsData, refetch: refetchImports } = useFetch<{ imports: ImportRecord[] }>(() => importApi.list(), []);
  const importMutation = useMutation(useCallback((data: any) => transactionsApi.bulkCreate(data), []));

  // ─── CSV Parser ───────────────────────────────

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
    if (parts.length === 3) { const [a, b, c] = parts; if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`; if (c.length === 4) return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`; if (c.length === 2) { const yr = parseInt(c) > 50 ? `19${c}` : `20${c}`; return `${yr}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`; } }
    return d;
  };

  const fetchExistingForRange = async (rows: RawTransaction[]) => {
    if (rows.length === 0) return [];
    const dates = rows.map(r => r.date).filter(Boolean).sort();
    try {
      const res = await transactionsApi.list({ dateFrom: dates[0], dateTo: dates[dates.length - 1], limit: 5000 });
      return (res?.transactions || []).map((t: any) => ({ date: t.date, amount: t.amount, description: t.description }));
    } catch { return []; }
  };

  // ─── File Upload Handler ──────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    setParseError('');
    setIsParsing(true);

    dispatch({ type: 'START_PARSING', files: files.map(f => ({ name: f.name, status: 'pending' })) });

    const allProcessed: ProcessedTransaction[] = [];
    const groups: FileGroup[] = [];
    const accumulated = { total: 0, autoMatched: 0, transfers: 0, duplicates: 0 };
    const rules = rulesData?.rules || {};

    for (const file of files) {
      dispatch({ type: 'FILE_STATUS', filename: file.name, status: 'parsing' });
      try {
        let raw: RawTransaction[] = [];
        if (file.name.toLowerCase().endsWith('.pdf')) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to parse PDF');
          raw = data.transactions;
        } else {
          const text = await file.text();
          raw = parseCSV(text);
          if (raw.length === 0) throw new Error('Could not parse any transactions. Check CSV format.');
        }

        const existing = await fetchExistingForRange(raw);
        const crossFileExisting = allProcessed.map(t => ({ date: t.date, amount: t.amount, description: t.description }));
        const result = processImport(raw, rules, [...existing, ...crossFileExisting]);

        const startIdx = allProcessed.length;
        allProcessed.push(...result.transactions);
        groups.push({ filename: file.name, startIdx, count: result.transactions.length });

        accumulated.total += result.stats.total;
        accumulated.autoMatched += result.stats.autoMatched;
        accumulated.transfers += result.stats.transfers;
        accumulated.duplicates += result.stats.duplicates;

        dispatch({ type: 'FILE_STATUS', filename: file.name, status: 'done', count: result.transactions.length });
      } catch (err: any) {
        dispatch({ type: 'FILE_STATUS', filename: file.name, status: 'error', error: err.message });
      }
    }

    setIsParsing(false);

    if (allProcessed.length > 0) {
      dispatch({ type: 'PROCESSING_COMPLETE', transactions: allProcessed, stats: accumulated, fileGroups: groups });
    } else {
      setParseError('No transactions could be parsed from the selected files.');
      dispatch({ type: 'RESET' });
    }
  };

  // ─── Categorize Handler ───────────────────────

  const handleCategorize = async (merchant: string, category: string) => {
    dispatch({ type: 'CATEGORIZE_MERCHANT', merchant, category });
    try { await merchantRulesApi.upsert({ merchant, category }); } catch {}
  };

  // ─── Import Handler ───────────────────────────

  const handleConfirmImport = async () => {
    const final = deriveFinalTransactions(state.transactions, state.merchantMap, state.excludeDupes);
    if (final.length === 0) return;

    let totalCreated = 0;
    const fileResults: { name: string; count: number }[] = [];

    // Import per file group using index ranges
    for (const group of state.fileGroups) {
      const groupIndices = new Set<number>();
      for (let i = group.startIdx; i < group.startIdx + group.count; i++) groupIndices.add(i);

      // Get the final transactions that came from this group
      const toImport: typeof final = [];
      let origIdx = 0;
      for (const t of final) {
        // Find which original index this corresponds to by matching
        const oi = state.transactions.findIndex((ot, i) => i >= origIdx && ot.date === t.date && ot.amount === t.amount && ot.description === t.description);
        if (oi >= 0 && groupIndices.has(oi)) {
          toImport.push(t);
          origIdx = oi + 1;
        }
      }

      if (toImport.length === 0) continue;
      try {
        const res = await transactionsApi.bulkCreate({
          transactions: toImport.map(t => ({
            date: t.date, description: t.description, originalDescription: t.originalDescription,
            amount: t.amount, category: t.category, account: t.account,
            autoMatched: t.autoMatched, flagged: false, transferPairId: t.transferPairId,
          })),
          importRecord: { filename: group.filename, sourceType: group.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv' },
        });
        if (res?.created) { totalCreated += res.created; fileResults.push({ name: group.filename, count: res.created }); }
      } catch {}
    }

    if (totalCreated > 0) {
      dispatch({ type: 'IMPORT_SUCCESS', result: { count: totalCreated, files: fileResults } });
      refetchImports();
    } else {
      dispatch({ type: 'IMPORT_ERROR', error: 'No transactions were imported.' });
    }
  };

  const handleDeleteImport = async (id: string) => {
    if (!confirm('Delete this import and all its transactions?')) return;
    await importApi.delete(id);
    refetchImports();
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' });
    setParseError('');
    setIsParsing(false);
  };

  // ─── Derived Values ───────────────────────────

  const uncategorizedCount = Array.from(state.merchantMap.values())
    .filter(g => g.category === 'Uncategorized')
    .reduce((s, g) => s + g.count, 0);

  const importCount = state.excludeDupes
    ? state.transactions.filter(t => !t.flagged).length
    : state.transactions.length;

  const currentMerchant = state.uncategorizedQueue[state.currentQueueIndex]
    ? state.merchantMap.get(state.uncategorizedQueue[state.currentQueueIndex])
    : undefined;

  // ─── Render ───────────────────────────────────

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Data Import</p>
        <h1 className="text-xl font-bold tracking-tight">Import</h1>
      </div>

      {(state.phase === 'upload' || state.phase === 'processing') && (
        <UploadPhase
          fileQueue={state.fileQueue}
          isParsing={isParsing}
          parseError={parseError}
          imports={importsData?.imports}
          onFileUpload={handleFileUpload}
          onDeleteImport={handleDeleteImport}
          onRefetchImports={refetchImports}
        />
      )}

      {state.phase === 'summary' && (
        <SummaryPhase
          stats={state.stats}
          merchantMap={state.merchantMap}
          uncategorizedCount={uncategorizedCount}
          fileGroups={state.fileGroups}
          sessionRulesCount={state.sessionRules.size}
          onProceed={() => {
            const hasUncategorized = state.uncategorizedQueue.length > 0;
            dispatch({ type: 'ADVANCE_PHASE', phase: hasUncategorized ? 'categorize' : 'confirm' });
          }}
          onReset={handleReset}
        />
      )}

      {state.phase === 'categorize' && currentMerchant && categories && (
        <CategorizePhase
          merchant={currentMerchant}
          queueIndex={state.currentQueueIndex}
          queueTotal={state.uncategorizedQueue.length}
          categories={categories}
          sessionRules={state.sessionRules}
          onCategorize={handleCategorize}
          onSkip={() => dispatch({ type: 'SKIP_MERCHANT' })}
          onReset={handleReset}
        />
      )}

      {state.phase === 'confirm' && (
        <ConfirmPhase
          stats={state.stats}
          merchantMap={state.merchantMap}
          excludeDupes={state.excludeDupes}
          importCount={importCount}
          isImporting={importMutation.isLoading}
          error={state.error}
          sessionRulesCount={state.sessionRules.size}
          onToggleDupes={() => dispatch({ type: 'TOGGLE_DUPES' })}
          onConfirm={handleConfirmImport}
          onReset={handleReset}
        />
      )}

      {state.phase === 'complete' && state.importResult && (
        <CompletePhase
          importResult={state.importResult}
          stats={state.stats}
          excludeDupes={state.excludeDupes}
          sessionRulesCount={state.sessionRules.size}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
