'use client';

import React, { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTransactions, useCategories, useAccountNicknames } from '@/hooks/use-data';
import { useMutation } from '@/hooks/use-fetch';
import { transactionsApi, expenseReportsApi } from '@/lib/api-client';
import { TransactionTableSkeleton } from '@/components/shared/skeletons';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryBadge } from '@/components/shared/category-badge';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import type { TransactionQuery, Transaction } from '@/types/models';

function TransactionsViewInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read initial filters from URL (heatmap, calendar, Sankey click-through)
  const urlDateFrom = searchParams.get('dateFrom') || '';
  const urlDateTo   = searchParams.get('dateTo')   || '';
  const urlCategory = searchParams.get('category') || '';
  const urlAccount  = searchParams.get('account')  || '';
  const urlSearch   = searchParams.get('search')   || '';

  const [query, setQuery] = useState<TransactionQuery>({
    page: 1,
    limit: 50,
    sort: 'date',
    order: 'desc',
  });
  const [search, setSearch] = useState(urlSearch);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [filterCategory, setFilterCategory] = useState(urlCategory);
  const [filterAccount, setFilterAccount] = useState(urlAccount);
  const [filterDateFrom, setFilterDateFrom] = useState(urlDateFrom);
  const [filterDateTo, setFilterDateTo] = useState(urlDateTo);

  // Keep filters in sync when URL params change (e.g. Sankey / heatmap navigation)
  useEffect(() => {
    setFilterDateFrom(urlDateFrom);
    setFilterDateTo(urlDateTo);
    setFilterCategory(urlCategory);
    setFilterAccount(urlAccount);
    setSearch(urlSearch);
    setActivePreset(null); // clear preset when URL drives the date
    setQuery(q => ({ ...q, page: 1 }));
  }, [urlDateFrom, urlDateTo, urlCategory, urlAccount, urlSearch]);

  const clearDateFilter = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setActivePreset(null);
    setQuery(q => ({ ...q, page: 1 }));
    router.replace('/transactions');
  };

  const { data, error, isLoading, refetch } = useTransactions({
    ...query,
    search: search || undefined,
    category: filterCategory || undefined,
    account: filterAccount || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
  });
  const { data: categories } = useCategories();
  const { getDisplayName } = useAccountNicknames();

  const updateMutation = useMutation(
    useCallback(({ id, data }: { id: string; data: any }) => transactionsApi.update(id, data), [])
  );
  const bulkDeleteMutation = useMutation(
    useCallback((ids: string[]) => transactionsApi.bulkDelete(ids), [])
  );
  const bulkUpdateMutation = useMutation(
    useCallback(({ ids, update }: { ids: string[]; update: any }) => transactionsApi.bulkUpdate(ids, update), [])
  );

  // Expense reports for "add to report" action (bulk + per-row)
  const [expenseReports, setExpenseReports] = useState<{ id: string; title: string }[]>([]);
  const [expenseMsg, setExpenseMsg] = useState<string | null>(null);
  const [expensedTxIds, setExpensedTxIds] = useState<Set<string>>(new Set());
  const [expenseDropdownId, setExpenseDropdownId] = useState<string | null>(null);
  const [expenseDropdownPos, setExpenseDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const fetchExpenseReports = useCallback(() => {
    expenseReportsApi.list().then(res => {
      const reports = res.reports || [];
      setExpenseReports(reports.filter((r: any) => r.status === 'draft'));
      // Build set of all transaction IDs already in any expense report
      const txIds = new Set<string>();
      for (const r of reports) {
        for (const item of r.items || []) txIds.add(item.transactionId);
      }
      setExpensedTxIds(txIds);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchExpenseReports(); }, [fetchExpenseReports]);

  const handleAddToExpenseReport = async (reportId: string, txIds?: string[]) => {
    const ids = txIds || [...selectedIds];
    if (ids.length === 0) return;
    const res = await expenseReportsApi.addItems(reportId, ids);
    setExpenseMsg(`Added ${res.added} transaction(s) to expense report`);
    if (!txIds) setSelectedIds(new Set());
    setExpenseDropdownId(null);
    setExpenseDropdownPos(null);
    fetchExpenseReports();
    setTimeout(() => setExpenseMsg(null), 3000);
  };

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

  const accounts = useMemo(() => [...new Set(transactions.map((t) => t.account))].sort(), [transactions]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditFields({ description: t.description, category: t.category, amount: t.amount });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateMutation.mutate({ id: editingId, data: editFields });
    setEditingId(null);
    setEditFields({});
    refetch();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({});
  };

  const startNoteEdit = (t: Transaction) => {
    setEditingNoteId(t.id);
    setNoteValue(t.note || '');
  };

  const saveNote = async () => {
    if (!editingNoteId) return;
    await updateMutation.mutate({ id: editingNoteId, data: { note: noteValue || null } });
    setEditingNoteId(null);
    setNoteValue('');
    refetch();
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setNoteValue('');
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} transaction(s)?`)) return;
    await bulkDeleteMutation.mutate([...selectedIds]);
    setSelectedIds(new Set());
    refetch();
  };

  const handleBulkRecategorize = async (category: string) => {
    if (selectedIds.size === 0) return;
    await bulkUpdateMutation.mutate({ ids: [...selectedIds], update: { category } });
    setSelectedIds(new Set());
    refetch();
  };

  const setPage = (p: number) => setQuery((q) => ({ ...q, page: p }));

  // Quick-sort presets
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const applyPreset = (label: string, from: string, to: string) => {
    setActivePreset(label);
    setFilterDateFrom(from);
    setFilterDateTo(to);
    setQuery((q) => ({ ...q, page: 1 }));
  };

  const clearPreset = () => {
    setActivePreset(null);
    setFilterDateFrom('');
    setFilterDateTo('');
    setQuery((q) => ({ ...q, page: 1 }));
  };

  const datePresets = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const startOf = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };

    const today = fmt(startOf(new Date()));
    const minus = (days: number) => fmt(startOf(new Date(Date.now() - days * 864e5)));

    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const presets: { label: string; from: string; to: string }[] = [
      { label: '1D',   from: today,                   to: today },
      { label: '7D',   from: minus(6),                to: today },
      { label: '30D',  from: minus(29),               to: today },
      { label: '3M',   from: minus(89),               to: today },
      { label: '6M',   from: minus(179),              to: today },
      { label: 'YTD',  from: `${thisYear}-01-01`,     to: today },
      { label: `${lastYear}`, from: `${lastYear}-01-01`, to: `${lastYear}-12-31` },
    ];

    // Add per-year chunks back to 2020
    for (let y = lastYear - 1; y >= 2020; y--) {
      presets.push({ label: `${y}`, from: `${y}-01-01`, to: `${y}-12-31` });
    }

    return presets;
  }, []);

  const toggleSort = (field: TransactionQuery['sort']) => {
    setQuery((q) => ({
      ...q,
      sort: field,
      order: q.sort === field && q.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (query.sort !== field) return <span className="opacity-20 ml-1">↕</span>;
    return (
      <span className="ml-1 text-primary">
        {query.order === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading && !data) return <TransactionTableSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Ledger</p>
            <h1 className="text-xl font-bold tracking-tight">Transactions</h1>
          </div>
          <div className="text-right">
            <p className="numeral text-2xl font-bold tabnum">{pagination.total.toLocaleString()}</p>
            <p className="ticker">total records</p>
          </div>
        </div>
      </div>

      {/* Date filter banner — shown when coming from heatmap/calendar */}
      {(filterDateFrom || filterDateTo) && (
        <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-2.5 animate-fade-in">
          <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span className="text-xs font-medium text-primary">
            Filtered by date:&nbsp;
            {filterDateFrom === filterDateTo
              ? filterDateFrom
              : `${filterDateFrom || '…'} → ${filterDateTo || '…'}`}
          </span>
          <button
            onClick={clearDateFilter}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            Clear
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setQuery((q) => ({ ...q, page: 1 })); }}
            className="pl-9 h-9"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setQuery((q) => ({ ...q, page: 1 })); }}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        >
          <option value="">All categories</option>
          <optgroup label="Expense">
            {categories?.filter(c => c.type === 'expense').map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="Income">
            {categories?.filter(c => c.type === 'income').map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </optgroup>
          <optgroup label="System">
            {categories?.filter(c => c.type === 'system').map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </optgroup>
        </select>

        {accounts.length > 1 && (
          <select
            value={filterAccount}
            onChange={(e) => { setFilterAccount(e.target.value); setQuery((q) => ({ ...q, page: 1 })); }}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a} value={a}>{getDisplayName(a)}</option>
            ))}
          </select>
        )}

      </div>

      {/* Quick date presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => { if (activePreset === 'All') { clearPreset(); } else { setActivePreset('All'); setFilterDateFrom(''); setFilterDateTo(''); setQuery(q => ({ ...q, page: 1 })); router.replace('/transactions'); } }}
          className={cn(
            'px-2.5 py-1 text-[11px] font-mono border transition-colors',
            activePreset === 'All'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-surface-1 text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
        >
          All
        </button>
        {datePresets.map((p) => (
          <button
            key={p.label}
            onClick={() => activePreset === p.label ? clearPreset() : applyPreset(p.label, p.from, p.to)}
            className={cn(
              'px-2.5 py-1 text-[11px] font-mono border transition-colors',
              activePreset === p.label
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-1 text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="text-muted-foreground/40 text-xs mx-1">|</span>
        {/* Custom range pickers */}
        <Input
          type="date"
          value={filterDateFrom}
          onChange={(e) => { setActivePreset(null); setFilterDateFrom(e.target.value); setQuery(q => ({ ...q, page: 1 })); }}
          className="h-7 w-[130px] text-xs"
          title="From date"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
          type="date"
          value={filterDateTo}
          onChange={(e) => { setActivePreset(null); setFilterDateTo(e.target.value); setQuery(q => ({ ...q, page: 1 })); }}
          className="h-7 w-[130px] text-xs"
          title="To date"
        />
        {(filterDateFrom || filterDateTo) && !activePreset && (
          <button
            onClick={clearPreset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5"
          >
            ✕
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 px-4 py-2.5 animate-fade-in">
          <span className="ticker text-primary">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <select
            onChange={(e) => { if (e.target.value) handleBulkRecategorize(e.target.value); e.target.value = ''; }}
            className="h-7 border border-border bg-surface-2 px-2 text-xs font-mono focus:outline-none focus:border-primary"
            defaultValue=""
          >
            <option value="" disabled>Recategorize...</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          {expenseReports.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) handleAddToExpenseReport(e.target.value, [...selectedIds]); e.target.value = ''; }}
              className="h-7 border border-border bg-surface-2 px-2 text-xs font-mono focus:outline-none focus:border-primary"
              defaultValue=""
            >
              <option value="" disabled>Expense Report...</option>
              {expenseReports.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          )}
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            Delete
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ticker text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>
        </div>
      )}

      {expenseMsg && (
        <div className="flex items-center gap-2 text-xs px-3 py-2.5 border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 animate-fade-in">
          <span className="font-semibold shrink-0">&#10003;</span>
          <span>{expenseMsg}</span>
        </div>
      )}

      {error && <ErrorAlert message={error} retry={refetch} />}

      {/* Table */}
      {transactions.length === 0 && !isLoading ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          title="No transactions found"
          description={search || filterCategory ? 'Try adjusting your filters' : 'Import a bank statement to get started'}
        />
      ) : (
        <div className="border border-border bg-surface-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === transactions.length && transactions.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('date')}>
                    <span className="ticker">Date <SortIcon field="date" /></span>
                  </th>
                  <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('description')}>
                    <span className="ticker">Description <SortIcon field="description" /></span>
                  </th>
                  <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('category')}>
                    <span className="ticker">Category <SortIcon field="category" /></span>
                  </th>
                  <th className="text-left px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('account')}>
                    <span className="ticker">Account <SortIcon field="account" /></span>
                  </th>
                  <th className="text-right px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                    <span className="ticker">Amount <SortIcon field="amount" /></span>
                  </th>
                  <th className="w-16 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <React.Fragment key={t.id}>
                  <tr
                    className={cn(
                      'transition-colors hover:bg-surface-2/60',
                      !editingNoteId || editingNoteId !== t.id ? 'border-b border-border last:border-0' : '',
                      t.flagged && 'bg-yellow-500/5',
                      selectedIds.has(t.id) && 'bg-primary/5'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="w-3.5 h-3.5 accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabnum font-mono text-xs">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-3 py-2.5 max-w-[250px]">
                      {editingId === t.id ? (
                        <Input
                          value={editFields.description || ''}
                          onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                          className="h-7 text-xs"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button
                            onClick={() => startEdit(t)}
                            className="text-left truncate text-foreground/90 hover:text-primary transition-colors text-xs min-w-0"
                            title={t.originalDescription ? `Original: ${t.originalDescription}` : t.description}
                          >
                            {t.description}
                          </button>
                          {/* Pencil badge — shown when description was manually edited */}
                          {t.originalDescription && t.originalDescription !== t.description && (
                            <span
                              title={`Edited · Original: ${t.originalDescription}`}
                              className="shrink-0 text-[9px] text-primary/60 hover:text-primary cursor-help transition-colors"
                            >
                              ✎
                            </span>
                          )}
                          {/* Auto-matched badge */}
                          {t.autoMatched && (
                            <span
                              title="Auto-categorized"
                              className="shrink-0 text-[8px] font-mono bg-primary/10 text-primary px-1 rounded-sm"
                            >
                              auto
                            </span>
                          )}
                          {/* Transfer badge */}
                          {(t.category === 'Transfer' || t.transferPairId) && (
                            <span
                              title={t.transferPairId ? `Transfer pair: ${t.transferPairId}` : 'Transfer'}
                              className="shrink-0 text-[8px] font-mono bg-blue-500/10 text-blue-400 px-1 rounded-sm"
                            >
                              xfer
                            </span>
                          )}
                          {/* Return badge */}
                          {(t.category === 'Returns' || t.returnPairId) && (
                            <span
                              title={t.returnPairId ? `Return pair: ${t.returnPairId}` : 'Return/Refund'}
                              className="shrink-0 text-[8px] font-mono bg-orange-500/10 text-orange-400 px-1 rounded-sm"
                            >
                              return
                            </span>
                          )}
                          {/* Flagged badge */}
                          {t.flagged && (
                            <span
                              title="Flagged as potential duplicate"
                              className="shrink-0 text-[8px] font-mono bg-yellow-500/15 text-yellow-500 px-1 rounded-sm"
                            >
                              dupe?
                            </span>
                          )}
                          {/* Expense report badge */}
                          {expensedTxIds.has(t.id) && (
                            <span
                              title="In expense report"
                              className="shrink-0 text-[8px] font-mono bg-purple-500/10 text-purple-400 px-1 rounded-sm"
                            >
                              expense
                            </span>
                          )}
                          {/* Note badge */}
                          {t.note && (
                            <span
                              title={t.note}
                              className="shrink-0 text-[8px] font-mono bg-sky-500/10 text-sky-400 px-1 rounded-sm cursor-help"
                            >
                              note
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {editingId === t.id ? (
                        <select
                          value={editFields.category || ''}
                          onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))}
                          className="h-7 border border-border bg-surface-2 px-2 text-xs font-mono focus:outline-none focus:border-primary"
                        >
                          {categories?.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <CategoryBadge category={t.category} />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground" title={t.account}>{getDisplayName(t.account)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Amount value={t.amount} size="sm" showSign />
                    </td>
                    <td className="px-3 py-2.5">
                      {editingId === t.id ? (
                        <div className="flex gap-1.5">
                          <button onClick={saveEdit} className="text-primary hover:text-primary/70 transition-colors" title="Save">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                          </button>
                          <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancel">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 items-center">
                          {/* Expense report quick-add */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (expenseDropdownId === t.id) {
                                  setExpenseDropdownId(null);
                                  setExpenseDropdownPos(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setExpenseDropdownPos({ top: rect.bottom + 4, left: rect.right });
                                  setExpenseDropdownId(t.id);
                                }
                              }}
                              className={cn(
                                'transition-colors',
                                expensedTxIds.has(t.id)
                                  ? 'text-purple-400 hover:text-purple-300'
                                  : 'text-muted-foreground/30 hover:text-purple-400',
                              )}
                              title={expensedTxIds.has(t.id) ? 'Already in expense report' : 'Add to expense report'}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                                <rect x="9" y="3" width="6" height="4" rx="1" />
                                {expensedTxIds.has(t.id) && <path d="M9 14l2 2 4-4" />}
                              </svg>
                            </button>
                            {expenseDropdownId === t.id && expenseDropdownPos && expenseReports.length > 0 && (
                              <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => { setExpenseDropdownId(null); setExpenseDropdownPos(null); }} />
                                <div
                                  className="fixed z-[9999] bg-surface-1 border border-border shadow-lg min-w-[180px] py-1 animate-fade-in"
                                  style={{ top: expenseDropdownPos.top, left: expenseDropdownPos.left, transform: 'translateX(-100%)' }}
                                >
                                  <p className="px-3 py-1 text-[10px] text-muted-foreground font-mono">Add to report:</p>
                                  {expenseReports.map(r => (
                                    <button
                                      key={r.id}
                                      onClick={(e) => { e.stopPropagation(); handleAddToExpenseReport(r.id, [t.id]); setExpenseDropdownPos(null); }}
                                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 hover:text-primary transition-colors truncate"
                                    >
                                      {r.title}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            {expenseDropdownId === t.id && expenseDropdownPos && expenseReports.length === 0 && (
                              <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => { setExpenseDropdownId(null); setExpenseDropdownPos(null); }} />
                                <div
                                  className="fixed z-[9999] bg-surface-1 border border-border shadow-lg min-w-[180px] py-2 px-3 animate-fade-in"
                                  style={{ top: expenseDropdownPos.top, left: expenseDropdownPos.left, transform: 'translateX(-100%)' }}
                                >
                                  <p className="text-[11px] text-muted-foreground">No draft reports. Create one in <a href="/expenses" className="text-primary hover:underline">Expenses</a>.</p>
                                </div>
                              </>
                            )}
                          </div>
                          {/* Note button */}
                          <button
                            onClick={() => editingNoteId === t.id ? cancelNoteEdit() : startNoteEdit(t)}
                            className={cn(
                              'transition-colors',
                              t.note ? 'text-sky-400 hover:text-sky-300' : 'text-muted-foreground/30 hover:text-sky-400',
                            )}
                            title={t.note ? `Note: ${t.note}` : 'Add note'}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                          </button>
                          {/* Edit button */}
                          <button
                            onClick={() => startEdit(t)}
                            className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                            title="Edit"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {editingNoteId === t.id && (
                    <tr className="border-b border-border bg-sky-500/5 animate-fade-in">
                      <td></td>
                      <td colSpan={6} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400 shrink-0">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                          <input
                            autoFocus
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') cancelNoteEdit(); }}
                            placeholder="Add a note (e.g. bought as a gift, for birthday)..."
                            className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border text-foreground outline-none focus:border-sky-400 transition-colors"
                          />
                          <button onClick={saveNote} className="text-sky-400 hover:text-sky-300 transition-colors" title="Save note">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                          </button>
                          <button onClick={cancelNoteEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancel">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals summary — uses server-side totals across all matching transactions */}
          {transactions.length > 0 && (() => {
            const totals = data?.totals;
            const income = totals?.income ?? transactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
            const expenses = totals?.expenses ?? transactions.reduce((s, t) => s + (t.amount < 0 ? Math.abs(t.amount) : 0), 0);
            const net = income - expenses;
            const hasIncome = income > 0;
            const hasExpenses = expenses > 0;
            const hasBoth = hasIncome && hasExpenses;
            const isFiltered = !!(search || filterCategory || filterAccount || filterDateFrom || filterDateTo || activePreset);
            const showAllLabel = totals && pagination.totalPages > 1;

            return (
              <div className="border-t border-border px-4 py-2.5 bg-surface-2/80 flex items-center justify-end gap-4 text-xs font-mono">
                {showAllLabel && (
                  <span className="text-muted-foreground/60 mr-auto">
                    {isFiltered ? 'Filtered' : 'All'} {pagination.total.toLocaleString()} transactions
                  </span>
                )}
                {hasIncome && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{hasBoth ? 'Income' : 'Total'}</span>
                    <span className="font-semibold tabnum text-income">+{formatCurrency(income)}</span>
                  </span>
                )}
                {hasExpenses && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{hasBoth ? 'Expenses' : 'Total'}</span>
                    <span className="font-semibold tabnum text-expense">-{formatCurrency(expenses)}</span>
                  </span>
                )}
                {hasBoth && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Net</span>
                    <span className={`font-semibold tabnum ${net >= 0 ? 'text-income' : 'text-expense'}`}>
                      {net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}
                    </span>
                  </span>
                )}
              </div>
            );
          })()}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-surface-2">
              <p className="ticker">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TransactionsView() {
  return (
    <Suspense fallback={<TransactionTableSkeleton />}>
      <TransactionsViewInner />
    </Suspense>
  );
}
