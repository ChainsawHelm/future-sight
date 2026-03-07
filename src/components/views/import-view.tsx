'use client';

import { useState, useCallback, useMemo } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useCategories } from '@/hooks/use-data';
import { transactionsApi, importApi, merchantRulesApi } from '@/lib/api-client';
import { processImport, extractMerchant, type RawTransaction, type ProcessedTransaction } from '@/lib/import-engine';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { PlaidAccounts } from '@/components/plaid/plaid-accounts';
import { formatDate, cn } from '@/lib/utils';
import type { ImportRecord } from '@/types/models';

type ImportPhase = 'upload' | 'review' | 'complete';
type ReviewMode = 'merchants' | 'all';
interface ImportStats { total: number; autoMatched: number; transfers: number; duplicates: number; }
interface FileGroup { filename: string; startIdx: number; count: number; }
interface FileQueueItem { name: string; status: 'pending' | 'parsing' | 'done' | 'error'; count?: number; error?: string; }
interface MerchantGroup { merchant: string; category: string; count: number; total: number; indices: number[]; autoMatched: boolean; hasMultipleCategories: boolean; }

export function ImportView() {
  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [processed, setProcessed] = useState<ProcessedTransaction[]>([]);
  const [stats, setStats] = useState<ImportStats>({ total: 0, autoMatched: 0, transfers: 0, duplicates: 0 });
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [filename, setFilename] = useState('');
  const [importResult, setImportResult] = useState<{ count: number; files: { name: string; count: number }[] } | null>(null);
  const [parseError, setParseError] = useState('');
  const [excludeDupes, setExcludeDupes] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'category' | 'amount' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [rulePrompt, setRulePrompt] = useState<{ merchant: string; category: string; matchCount: number; matchingIndices: number[] } | null>(null);
  const [sessionRules, setSessionRules] = useState<{ merchant: string; category: string }[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('merchants');
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'' | 'uncategorized' | 'auto' | 'dupe' | 'transfer'>('');

  const { data: categories } = useCategories();
  const { data: rulesData } = useFetch<{ rules: Record<string, string> }>(() => merchantRulesApi.list(), []);
  const { data: importsData, refetch: refetchImports } = useFetch<{ imports: ImportRecord[] }>(() => importApi.list(), []);
  // Not used for duplicate detection anymore — we fetch per date range after parsing

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

  // Fetch existing transactions within the date range of the incoming rows
  const fetchExistingForRange = async (rows: RawTransaction[]) => {
    if (rows.length === 0) return [];
    const dates = rows.map(r => r.date).filter(Boolean).sort();
    const dateFrom = dates[0];
    const dateTo = dates[dates.length - 1];
    try {
      const res = await transactionsApi.list({ dateFrom, dateTo, limit: 5000 });
      return (res?.transactions || []).map((t: any) => ({ date: t.date, amount: t.amount, description: t.description }));
    } catch {
      return [];
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setParseError('');
    setFilename(files.length === 1 ? files[0].name : `${files.length} files`);
    setFileQueue(files.map(f => ({ name: f.name, status: 'pending' })));
    setIsParsing(true);

    const allProcessed: ProcessedTransaction[] = [];
    const groups: FileGroup[] = [];
    const accumulated: ImportStats = { total: 0, autoMatched: 0, transfers: 0, duplicates: 0 };
    const rules = rulesData?.rules || {};

    for (const file of files) {
      setFileQueue(prev => prev.map(q => q.name === file.name ? { ...q, status: 'parsing' } : q));

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
        // Also pass already-processed txns so cross-file dupes are caught
        const crossFileExisting = allProcessed.map(t => ({ date: t.date, amount: t.amount, description: t.description }));
        const result = processImport(raw, rules, [...existing, ...crossFileExisting]);

        const startIdx = allProcessed.length;
        allProcessed.push(...result.transactions);
        groups.push({ filename: file.name, startIdx, count: result.transactions.length });

        accumulated.total        += result.stats.total;
        accumulated.autoMatched  += result.stats.autoMatched;
        accumulated.transfers    += result.stats.transfers;
        accumulated.duplicates   += result.stats.duplicates;

        setFileQueue(prev => prev.map(q => q.name === file.name ? { ...q, status: 'done', count: result.transactions.length } : q));
      } catch (err: any) {
        setFileQueue(prev => prev.map(q => q.name === file.name ? { ...q, status: 'error', error: err.message } : q));
      }
    }

    setIsParsing(false);

    if (allProcessed.length > 0) {
      setProcessed(allProcessed);
      setStats(accumulated);
      setFileGroups(groups);
      setPhase('review');
    } else {
      setParseError('No transactions could be parsed from the selected files.');
    }
  };

  const handleCategoryChange = (idx: number, category: string) => {
    // Update this single transaction immediately and check for merchant rule prompt
    setProcessed(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], category, autoMatched: false };

      // Extract merchant keyword and find all matching transactions using fresh state
      const row = next[idx];
      const merchant = extractMerchant(row.description);
      if (merchant && merchant.length >= 2) {
        const matchingIndices = next
          .map((t, i) => i)
          .filter(i => i !== idx && extractMerchant(next[i].description) === merchant && next[i].category !== category);
        if (matchingIndices.length > 0) {
          // Schedule prompt outside setState
          setTimeout(() => setRulePrompt({ merchant, category, matchCount: matchingIndices.length, matchingIndices }), 0);
        }
      }

      return next;
    });
  };

  const handleBulkRecategorize = (category: string) => {
    setProcessed(prev => prev.map(t =>
      t.category === 'Uncategorized' ? { ...t, category, autoMatched: false } : t
    ));
  };

  const applyRuleToAll = async () => {
    if (!rulePrompt) return;
    const { merchant, category, matchingIndices } = rulePrompt;
    // Update all matching transactions
    setProcessed(prev => {
      const next = [...prev];
      for (const i of matchingIndices) next[i] = { ...next[i], category, autoMatched: true };
      return next;
    });
    // Save rule to DB
    try {
      await merchantRulesApi.upsert({ merchant, category });
      setSessionRules(prev => [...prev.filter(r => r.merchant !== merchant), { merchant, category }]);
    } catch {}
    setRulePrompt(null);
  };

  const saveRuleOnly = async () => {
    if (!rulePrompt) return;
    const { merchant, category } = rulePrompt;
    try {
      await merchantRulesApi.upsert({ merchant, category });
      setSessionRules(prev => [...prev.filter(r => r.merchant !== merchant), { merchant, category }]);
    } catch {}
    setRulePrompt(null);
  };

  const handleConfirmImport = async () => {
    let totalCreated = 0;
    const fileResults: { name: string; count: number }[] = [];

    for (const group of fileGroups) {
      const slice = processed.slice(group.startIdx, group.startIdx + group.count);
      const toImport = excludeDupes ? slice.filter(t => !t.flagged) : slice;
      if (toImport.length === 0) continue;
      try {
        const res = await transactionsApi.bulkCreate({
          transactions: toImport.map(t => ({ date: t.date, description: t.description, originalDescription: t.originalDescription, amount: t.amount, category: t.category, account: t.account, autoMatched: t.autoMatched, flagged: false, transferPairId: t.transferPairId })),
          importRecord: { filename: group.filename, sourceType: group.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'csv' },
        });
        if (res?.created) { totalCreated += res.created; fileResults.push({ name: group.filename, count: res.created }); }
      } catch {}
    }

    if (totalCreated > 0) {
      setImportResult({ count: totalCreated, files: fileResults });
      setPhase('complete');
      refetchImports();
    }
  };

  const handleDeleteImport = async (id: string) => { if (!confirm('Delete this import and all its transactions?')) return; await importApi.delete(id); refetchImports(); };
  const resetImport = () => { setPhase('upload'); setProcessed([]); setStats({ total: 0, autoMatched: 0, transfers: 0, duplicates: 0 }); setFileGroups([]); setFileQueue([]); setFilename(''); setImportResult(null); setParseError(''); setRulePrompt(null); setSessionRules([]); setReviewSearch(''); setReviewCategoryFilter(''); setReviewStatusFilter(''); setSortField(null); setReviewMode('merchants'); setExpandedMerchant(null); };
  const importCount = excludeDupes ? processed.filter(t => !t.flagged).length : processed.length;

  const toggleSort = (field: 'date' | 'category' | 'amount') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const uncategorizedCount = useMemo(() => processed.filter(t => t.category === 'Uncategorized').length, [processed]);

  // Build merchant groups
  const merchantGroups = useMemo(() => {
    const map = new Map<string, MerchantGroup>();
    processed.forEach((t, i) => {
      const merchant = extractMerchant(t.description) || t.description.slice(0, 30);
      const existing = map.get(merchant);
      if (existing) {
        existing.count++;
        existing.total += t.amount;
        existing.indices.push(i);
        if (existing.category !== t.category) existing.hasMultipleCategories = true;
      } else {
        map.set(merchant, {
          merchant,
          category: t.category,
          count: 1,
          total: t.amount,
          indices: [i],
          autoMatched: t.autoMatched,
          hasMultipleCategories: false,
        });
      }
    });
    const groups = Array.from(map.values());
    // Sort: uncategorized first, then by count desc
    groups.sort((a, b) => {
      const aUncat = a.category === 'Uncategorized' ? 0 : 1;
      const bUncat = b.category === 'Uncategorized' ? 0 : 1;
      if (aUncat !== bUncat) return aUncat - bUncat;
      return b.count - a.count;
    });
    return groups;
  }, [processed]);

  const filteredMerchantGroups = useMemo(() => {
    let groups = merchantGroups;
    if (reviewSearch) {
      const q = reviewSearch.toLowerCase();
      groups = groups.filter(g => g.merchant.toLowerCase().includes(q));
    }
    if (reviewCategoryFilter) {
      groups = groups.filter(g => g.category === reviewCategoryFilter);
    }
    if (reviewStatusFilter === 'uncategorized') groups = groups.filter(g => g.category === 'Uncategorized');
    else if (reviewStatusFilter === 'auto') groups = groups.filter(g => g.autoMatched);
    else if (reviewStatusFilter === 'dupe') groups = groups.filter(g => g.indices.some(i => processed[i].flagged));
    else if (reviewStatusFilter === 'transfer') groups = groups.filter(g => g.indices.some(i => processed[i].transferPairId));
    return groups;
  }, [merchantGroups, reviewSearch, reviewCategoryFilter, reviewStatusFilter, processed]);

  const handleGroupCategoryChange = (merchant: string, category: string) => {
    const group = merchantGroups.find(g => g.merchant === merchant);
    if (!group) return;
    setProcessed(prev => {
      const next = [...prev];
      for (const i of group.indices) {
        next[i] = { ...next[i], category, autoMatched: false };
      }
      return next;
    });
    // Save as merchant rule
    if (merchant.length >= 2) {
      merchantRulesApi.upsert({ merchant, category }).then(() => {
        setSessionRules(prev => [...prev.filter(r => r.merchant !== merchant), { merchant, category }]);
      }).catch(() => {});
    }
  };

  const sortedProcessed = useMemo(() => {
    let items = processed.map((t, i) => ({ ...t, _origIdx: i }));

    // Apply filters
    if (reviewSearch) {
      const q = reviewSearch.toLowerCase();
      items = items.filter(t => t.description.toLowerCase().includes(q) || t.account.toLowerCase().includes(q));
    }
    if (reviewCategoryFilter) {
      items = items.filter(t => t.category === reviewCategoryFilter);
    }
    if (reviewStatusFilter === 'uncategorized') items = items.filter(t => t.category === 'Uncategorized');
    else if (reviewStatusFilter === 'auto') items = items.filter(t => t.autoMatched);
    else if (reviewStatusFilter === 'dupe') items = items.filter(t => t.flagged);
    else if (reviewStatusFilter === 'transfer') items = items.filter(t => !!t.transferPairId);

    // Apply sort
    if (sortField) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'date') cmp = a.date.localeCompare(b.date);
        else if (sortField === 'category') cmp = a.category.localeCompare(b.category);
        else if (sortField === 'amount') cmp = a.amount - b.amount;
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return items;
  }, [processed, reviewSearch, reviewCategoryFilter, reviewStatusFilter, sortField, sortDir]);

  const sortIcon = (field: string) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Data Import</p>
        <h1 className="text-xl font-bold tracking-tight">Import</h1>
      </div>

      {phase === 'upload' && (
        <div className="space-y-4">
          <PlaidAccounts onSync={() => refetchImports()} />

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
            <p className="ticker mb-5 text-[10px]">Each file gets its own import record. Cross-file duplicates are automatically detected.</p>
            <label className="inline-block">
              <input type="file" accept=".csv,.txt,.pdf" onChange={handleFileUpload} className="hidden" disabled={isParsing} multiple />
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

          {/* File processing queue */}
          {fileQueue.length > 0 && (
            <div className="border border-border bg-surface-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="ticker">Processing Queue</p>
              </div>
              <div className="divide-y divide-border">
                {fileQueue.map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn('w-4 h-4 flex items-center justify-center text-[10px] shrink-0',
                      f.status === 'done'    ? 'text-income'
                      : f.status === 'error'  ? 'text-expense'
                      : f.status === 'parsing'? 'text-primary'
                      : 'text-muted-foreground/30'
                    )}>
                      {f.status === 'done' ? '✓' : f.status === 'error' ? '✕' : f.status === 'parsing' ? '…' : '○'}
                    </span>
                    <p className="text-xs font-mono flex-1 truncate">{f.name}</p>
                    <p className="ticker text-[10px] shrink-0">
                      {f.status === 'done'    ? `${f.count} transactions`
                       : f.status === 'error'  ? f.error
                       : f.status === 'parsing'? 'Parsing...'
                       : 'Pending'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parseError && <ErrorAlert message={parseError} />}

          {importsData?.imports && importsData.imports.length > 0 && (
            <div className="border border-border bg-surface-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="ticker">Import History</p>
              </div>
              <div className="divide-y divide-border">
                {importsData.imports.map(imp => (
                  <div key={imp.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2/60 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{imp.filename}</p>
                      <p className="ticker">{imp.transactionCount} transactions · {formatDate(imp.importedAt)}</p>
                    </div>
                    <button onClick={() => handleDeleteImport(imp.id)} className="text-muted-foreground/30 hover:text-expense transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface-1">
            {[
              { label: 'Total Parsed', value: stats.total, color: 'text-foreground' },
              { label: 'Auto-Categorized', value: stats.autoMatched, color: 'text-primary' },
              { label: 'Transfer Pairs', value: stats.transfers, color: 'text-purple-400' },
              { label: 'Duplicates', value: stats.duplicates, color: 'text-yellow-400' },
            ].map((s, i) => (
              <div key={s.label} className={`px-4 py-3 ${i > 0 ? 'border-l border-border' : ''}`}>
                <p className="ticker mb-1">{s.label}</p>
                <p className={`numeral font-bold text-xl tabnum ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-mono font-medium">{filename}</p>
                {fileGroups.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {fileGroups.map(g => (
                      <span key={g.filename} className="ticker text-[9px] px-1.5 py-0.5 bg-surface-3 border border-border">{g.filename} ({g.count})</span>
                    ))}
                  </div>
                )}
              </div>
              {stats.duplicates > 0 && (
                <label className="flex items-center gap-2 ticker cursor-pointer">
                  <input type="checkbox" checked={excludeDupes} onChange={e => setExcludeDupes(e.target.checked)} className="accent-primary" />
                  Exclude {stats.duplicates} duplicate{stats.duplicates !== 1 ? 's' : ''}
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetImport}>Cancel</Button>
              <button
                onClick={handleConfirmImport}
                disabled={importMutation.isLoading}
                className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
              >
                {importMutation.isLoading ? 'Importing...' : `Import ${importCount} Transactions`}
              </button>
            </div>
          </div>

          {/* View toggle + search/filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-border bg-surface-2 h-8">
              <button
                onClick={() => setReviewMode('merchants')}
                className={cn('px-3 text-xs font-mono transition-colors', reviewMode === 'merchants' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                By Merchant
              </button>
              <button
                onClick={() => setReviewMode('all')}
                className={cn('px-3 text-xs font-mono transition-colors border-l border-border', reviewMode === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                All ({processed.length})
              </button>
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                placeholder={reviewMode === 'merchants' ? 'Search merchants...' : 'Search descriptions...'}
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 rounded-md border border-border bg-background text-xs font-mono text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={reviewStatusFilter}
              onChange={e => setReviewStatusFilter(e.target.value as any)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All status</option>
              <option value="uncategorized">Uncategorized ({uncategorizedCount})</option>
              <option value="auto">Auto-matched</option>
              <option value="dupe">Duplicates</option>
              <option value="transfer">Transfers</option>
            </select>
            {(reviewSearch || reviewStatusFilter || reviewCategoryFilter) && (
              <button
                onClick={() => { setReviewSearch(''); setReviewStatusFilter(''); setReviewCategoryFilter(''); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                Clear filters
              </button>
            )}
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              {reviewMode === 'merchants'
                ? `${filteredMerchantGroups.length} merchants · ${processed.length} transactions`
                : `${sortedProcessed.length} of ${processed.length} shown`
              }
            </span>
          </div>

          {/* Bulk recategorize uncategorized */}
          {uncategorizedCount > 0 && (
            <div className="flex items-center gap-3 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
              <span className="text-yellow-400 text-xs shrink-0">⚠</span>
              <span className="ticker text-yellow-400">{uncategorizedCount} uncategorized</span>
              <span className="text-muted-foreground text-xs">— bulk assign all:</span>
              <select
                onChange={e => { if (e.target.value) { handleBulkRecategorize(e.target.value); e.target.value = ''; } }}
                className="h-7 border border-border bg-surface-2 px-2 text-xs font-mono focus:outline-none focus:border-primary"
                defaultValue=""
              >
                <option value="" disabled>Choose category...</option>
                <optgroup label="Expense">
                  {categories?.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </optgroup>
                <optgroup label="Income">
                  {categories?.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </optgroup>
                <optgroup label="System">
                  {categories?.filter(c => c.type === 'system').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </optgroup>
              </select>
            </div>
          )}

          {importMutation.error && <ErrorAlert message={importMutation.error} />}

          {/* Session rules created during this import */}
          {sessionRules.length > 0 && (
            <div className="border border-border bg-surface-1 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="ticker">Rules Created This Session</p>
                <span className="ticker text-[10px] text-primary font-semibold">{sessionRules.length} rule{sessionRules.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-2.5">
                {sessionRules.map(r => (
                  <span key={r.merchant} className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 bg-surface-2 border border-border">
                    <span className="text-muted-foreground">{r.merchant}</span>
                    <span className="text-muted-foreground/40">&rarr;</span>
                    <span className="text-primary font-semibold">{r.category}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ─── MERCHANT-GROUPED VIEW ─── */}
          {reviewMode === 'merchants' && (
            <div className="border border-border bg-surface-1">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-surface-2 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2.5 w-8"><span className="ticker"></span></th>
                      <th className="text-left px-3 py-2.5"><span className="ticker">Merchant</span></th>
                      <th className="text-center px-3 py-2.5 w-16"><span className="ticker">Count</span></th>
                      <th className="text-left px-3 py-2.5"><span className="ticker">Category</span></th>
                      <th className="text-right px-3 py-2.5"><span className="ticker">Total</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMerchantGroups.map((group) => {
                      const isExpanded = expandedMerchant === group.merchant;
                      const groupTxns = group.indices.map(i => processed[i]);
                      return (
                        <>
                          <tr
                            key={group.merchant}
                            className={cn(
                              'border-b border-border transition-colors hover:bg-surface-2/60 cursor-pointer',
                              group.category === 'Uncategorized' && 'bg-yellow-500/[0.03]'
                            )}
                            onClick={() => setExpandedMerchant(isExpanded ? null : group.merchant)}
                          >
                            <td className="px-3 py-2.5 text-muted-foreground/50 text-[10px]">
                              {isExpanded ? '▼' : '▶'}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-medium">{group.merchant}</span>
                                {group.autoMatched && <span className="text-[9px] font-mono text-primary">AUTO</span>}
                                {group.indices.some(i => processed[i].flagged) && <span className="text-[9px] font-mono text-yellow-400">DUPE</span>}
                                {group.indices.some(i => processed[i].transferPairId) && <span className="text-[9px] font-mono text-purple-400">XFER</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={cn(
                                'inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[10px] font-mono font-semibold',
                                group.count > 1 ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'
                              )}>
                                {group.count}
                              </span>
                            </td>
                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                              <select
                                value={group.category}
                                onChange={e => handleGroupCategoryChange(group.merchant, e.target.value)}
                                className={cn(
                                  'h-7 border px-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
                                  group.category === 'Uncategorized'
                                    ? 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400'
                                    : 'border-border bg-surface-2 text-foreground/80'
                                )}
                              >
                                <option value="Uncategorized">Uncategorized</option>
                                <optgroup label="Expense">
                                  {categories?.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </optgroup>
                                <optgroup label="Income">
                                  {categories?.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </optgroup>
                                <optgroup label="System">
                                  {categories?.filter(c => c.type === 'system').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </optgroup>
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-right"><Amount value={group.total} size="sm" showSign /></td>
                          </tr>
                          {isExpanded && groupTxns.map((t, ti) => (
                            <tr key={`${group.merchant}-${ti}`} className="border-b border-border/50 bg-surface-2/30">
                              <td className="px-3 py-1.5"></td>
                              <td className="px-3 py-1.5 text-[11px] text-muted-foreground pl-8">
                                <span className="font-mono text-muted-foreground/60 mr-2">{t.date}</span>
                                <span className="truncate" title={t.originalDescription || t.description}>{t.description}</span>
                              </td>
                              <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground font-mono">{t.account}</td>
                              <td className="px-3 py-1.5 text-[10px] font-mono">
                                {t.flagged ? <span className="text-yellow-400">Dupe</span>
                                  : t.transferPairId ? <span className="text-purple-400">Transfer</span>
                                  : <span className="text-muted-foreground">{t.category}</span>}
                              </td>
                              <td className="px-3 py-1.5 text-right"><Amount value={t.amount} size="sm" showSign /></td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom summary */}
              {processed.length > 0 && (() => {
                const rows = excludeDupes ? processed.filter(t => !t.flagged) : processed;
                const total = rows.reduce((s, t) => s + t.amount, 0);
                const income = rows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const expenses = rows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
                return (
                  <div className="border-t border-border px-4 py-2.5 bg-surface-2/80 flex items-center justify-end gap-4 text-xs font-mono">
                    <span className="text-muted-foreground/60 mr-auto">{filteredMerchantGroups.length} merchants · {processed.length} transactions</span>
                    {income > 0 && <span className="text-income tabnum">+${income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                    {expenses > 0 && <span className="text-expense tabnum">-${expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                    <span className={cn('font-semibold tabnum', total >= 0 ? 'text-income' : 'text-expense')}>
                      Net: {total >= 0 ? '+' : '-'}${Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─── ALL TRANSACTIONS VIEW ─── */}
          {reviewMode === 'all' && (
            <div className="border border-border bg-surface-1">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-surface-2 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2.5 w-16"><span className="ticker">Status</span></th>
                      <th className="text-left px-3 py-2.5 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('date')}><span className="ticker">Date{sortIcon('date')}</span></th>
                      <th className="text-left px-3 py-2.5"><span className="ticker">Description</span></th>
                      <th className="text-left px-3 py-2.5 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('category')}><span className="ticker">Category{sortIcon('category')}</span></th>
                      <th className="text-left px-3 py-2.5"><span className="ticker">Account</span></th>
                      <th className="text-right px-3 py-2.5 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('amount')}><span className="ticker">Amount{sortIcon('amount')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProcessed.map((row) => (
                      <tr key={row._origIdx} className={cn(
                        'border-b border-border last:border-0 transition-colors hover:bg-surface-2/60',
                        row.flagged && 'bg-yellow-500/5 opacity-60',
                        row.transferPairId && !row.flagged && 'bg-purple-500/5',
                        row.category === 'Uncategorized' && !row.flagged && 'bg-yellow-500/[0.03]'
                      )}>
                        <td className="px-3 py-2.5 font-mono text-[10px]">
                          {row.flagged ? <span className="text-yellow-400">⚠ Dupe</span>
                            : row.transferPairId ? <span className="text-purple-400">⇄ Xfer</span>
                            : row.autoMatched ? <span className="text-primary">✓ Auto</span>
                            : row.category === 'Uncategorized' ? <span className="text-yellow-500/70">? New</span>
                            : null}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground tabnum whitespace-nowrap">{row.date}</td>
                        <td className="px-3 py-2.5 text-xs max-w-[250px]">
                          <span className="block truncate" title={row.originalDescription || row.description}>{row.description}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={row.category}
                            onChange={e => handleCategoryChange(row._origIdx, e.target.value)}
                            className={cn(
                              'h-7 border px-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
                              row.category === 'Uncategorized'
                                ? 'border-yellow-500/40 bg-yellow-500/5 text-yellow-400'
                                : 'border-border bg-surface-2 text-foreground/80'
                            )}
                          >
                            <option value="Uncategorized">Uncategorized</option>
                            <optgroup label="Expense">
                              {categories?.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="Income">
                              {categories?.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </optgroup>
                            <optgroup label="System">
                              {categories?.filter(c => c.type === 'system').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">{row.account}</td>
                        <td className="px-3 py-2.5 text-right"><Amount value={row.amount} size="sm" showSign /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom summary */}
              {processed.length > 0 && (() => {
                const visibleRows = excludeDupes ? sortedProcessed.filter(t => !t.flagged) : sortedProcessed;
                const total = visibleRows.reduce((s, t) => s + t.amount, 0);
                const income = visibleRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const expenses = visibleRows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
                return (
                  <div className="border-t border-border px-4 py-2.5 bg-surface-2/80 flex items-center justify-end gap-4 text-xs font-mono">
                    <span className="text-muted-foreground/60 mr-auto">{sortedProcessed.length} rows</span>
                    {income > 0 && <span className="text-income tabnum">+${income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                    {expenses > 0 && <span className="text-expense tabnum">-${expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                    <span className={cn('font-semibold tabnum', total >= 0 ? 'text-income' : 'text-expense')}>
                      Net: {total >= 0 ? '+' : '-'}${Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {phase === 'complete' && importResult && (
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
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="outline" onClick={resetImport}>Import Another</Button>
            <button onClick={() => window.location.href = '/transactions'}
              className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
              View Transactions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
