'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { useAccountNicknames, useCategories } from '@/hooks/use-data';
import { expenseReportsApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Amount } from '@/components/shared/amount';
import { CategoryBadge } from '@/components/shared/category-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { PERIOD_OPTIONS, getPeriodLabel, getPeriodRange } from '@/lib/periods';
import type { ExpenseReport, Transaction } from '@/types/models';

type View = 'list' | 'detail' | 'add-transactions';

export function ExpensesView() {
  const { data, error, isLoading, refetch } = useFetch(
    () => expenseReportsApi.list(), []
  );
  const { getDisplayName } = useAccountNicknames();

  const [view, setView] = useState<View>('list');
  const [activeReport, setActiveReport] = useState<ExpenseReport | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const createMutation = useMutation(
    useCallback((d: { title: string; description?: string }) => expenseReportsApi.create(d), [])
  );
  const updateMutation = useMutation(
    useCallback(({ id, data: d }: { id: string; data: any }) => expenseReportsApi.update(id, d), [])
  );
  const deleteMutation = useMutation(
    useCallback((id: string) => expenseReportsApi.delete(id), [])
  );
  const removeItemsMutation = useMutation(
    useCallback(({ id, txIds }: { id: string; txIds: string[] }) => expenseReportsApi.removeItems(id, txIds), [])
  );

  const reports: ExpenseReport[] = data?.reports || [];

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createMutation.mutate({ title: newTitle.trim(), description: newDesc.trim() || undefined });
    setNewTitle('');
    setNewDesc('');
    setShowCreate(false);
    refetch();
  };

  const openReport = async (report: ExpenseReport) => {
    const res = await expenseReportsApi.get(report.id);
    setActiveReport(res.report);
    setView('detail');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense report?')) return;
    await deleteMutation.mutate(id);
    if (activeReport?.id === id) {
      setActiveReport(null);
      setView('list');
    }
    refetch();
  };

  const handleSubmit = async (id: string) => {
    await updateMutation.mutate({ id, data: { status: 'submitted' } });
    refetch();
    const res = await expenseReportsApi.get(id);
    setActiveReport(res.report);
  };

  const handleReopen = async (id: string) => {
    await updateMutation.mutate({ id, data: { status: 'draft' } });
    refetch();
    const res = await expenseReportsApi.get(id);
    setActiveReport(res.report);
  };

  const handleRemoveItem = async (txId: string) => {
    if (!activeReport) return;
    await removeItemsMutation.mutate({ id: activeReport.id, txIds: [txId] });
    const res = await expenseReportsApi.get(activeReport.id);
    setActiveReport(res.report);
    refetch();
  };

  const handleSaveTitle = async () => {
    if (!activeReport || !editTitle.trim()) return;
    await updateMutation.mutate({ id: activeReport.id, data: { title: editTitle.trim() } });
    setEditingTitle(false);
    const res = await expenseReportsApi.get(activeReport.id);
    setActiveReport(res.report);
    refetch();
  };

  const exportCSV = (report: ExpenseReport) => {
    const rows = ['Date,Description,Amount,Category,Account,Note'];
    for (const item of report.items) {
      const t = item.transaction;
      rows.push(`${t.date},"${t.description}",${t.amount},${t.category},${t.account},"${item.note || ''}"`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expense-report-${report.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (isLoading) return <PageLoader message="Loading expense reports..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  // ─── Add Transactions View ──────────────────
  if (view === 'add-transactions' && activeReport) {
    return (
      <AddTransactionsView
        report={activeReport}
        getDisplayName={getDisplayName}
        onDone={async () => {
          const res = await expenseReportsApi.get(activeReport.id);
          setActiveReport(res.report);
          setView('detail');
          refetch();
        }}
        onBack={() => setView('detail')}
      />
    );
  }

  // ─── Detail View ────────────────────────────
  if (view === 'detail' && activeReport) {
    const statusColors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-500/10 text-blue-500',
      approved: 'bg-green-500/10 text-green-500',
      rejected: 'bg-red-500/10 text-red-500',
    };

    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => { setView('list'); setActiveReport(null); }}
          className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back to reports
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="h-8 text-lg font-bold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveTitle}>Save</Button>
                <button onClick={() => setEditingTitle(false)} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setEditingTitle(true); setEditTitle(activeReport.title); }}
                title="Click to edit title"
              >
                {activeReport.title}
              </h1>
            )}
            {activeReport.description && (
              <p className="text-sm text-muted-foreground mt-1">{activeReport.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 uppercase ${statusColors[activeReport.status]}`}>
                {activeReport.status}
              </span>
              <span className="text-xs text-muted-foreground">
                Created {formatDate(activeReport.createdAt)}
              </span>
              {activeReport.submittedAt && (
                <span className="text-xs text-muted-foreground">
                  Submitted {formatDate(activeReport.submittedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {activeReport.status === 'draft' && (
              <>
                <Button size="sm" onClick={() => setView('add-transactions')}>
                  + Add Transactions
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleSubmit(activeReport.id)}>
                  Submit
                </Button>
              </>
            )}
            {activeReport.status === 'submitted' && (
              <Button size="sm" variant="outline" onClick={() => handleReopen(activeReport.id)}>
                Reopen
              </Button>
            )}
            {activeReport.items.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => exportCSV(activeReport)}>
                Export CSV
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => handleDelete(activeReport.id)}>
              Delete
            </Button>
          </div>
        </div>

        {/* Total */}
        <div className="border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{activeReport.items.length} expense{activeReport.items.length !== 1 ? 's' : ''}</span>
            <span className="text-xl font-bold tabnum">{formatCurrency(activeReport.totalAmount)}</span>
          </div>
        </div>

        {/* Items table */}
        {activeReport.items.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Add transactions from your transaction list to build this expense report."
            action={activeReport.status === 'draft' ? (
              <Button size="sm" onClick={() => setView('add-transactions')}>Add Transactions</Button>
            ) : undefined}
          />
        ) : (
          <div className="border border-border bg-surface-1 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="text-left px-3 py-2.5 ticker">Date</th>
                  <th className="text-left px-3 py-2.5 ticker">Description</th>
                  <th className="text-left px-3 py-2.5 ticker">Category</th>
                  <th className="text-left px-3 py-2.5 ticker">Account</th>
                  <th className="text-right px-3 py-2.5 ticker">Amount</th>
                  {activeReport.status === 'draft' && <th className="w-10 px-3 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {activeReport.items.map(item => {
                  const t = item.transaction;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabnum font-mono text-xs">{formatDate(t.date)}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[250px] truncate">{t.description}</td>
                      <td className="px-3 py-2.5"><CategoryBadge category={t.category} /></td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{getDisplayName(t.account)}</td>
                      <td className="px-3 py-2.5 text-right"><Amount value={t.amount} size="sm" showSign /></td>
                      {activeReport.status === 'draft' && (
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => handleRemoveItem(t.id)}
                            className="text-muted-foreground/30 hover:text-red-500 transition-colors"
                            title="Remove from report"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ─── List View ──────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expense Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Tag transactions and build expense reports</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Report</Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border bg-card p-4 space-y-3 animate-fade-in">
          <Input
            placeholder="Report title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <Input
            placeholder="Description (optional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setNewTitle(''); setNewDesc(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {reports.length === 0 && !showCreate ? (
        <EmptyState
          title="No expense reports"
          description="Create an expense report, then add transactions you need to expense."
          action={<Button size="sm" onClick={() => setShowCreate(true)}>New Report</Button>}
        />
      ) : (
        <div className="space-y-2">
          {reports.map(report => {
            const statusColors: Record<string, string> = {
              draft: 'bg-muted text-muted-foreground',
              submitted: 'bg-blue-500/10 text-blue-500',
              approved: 'bg-green-500/10 text-green-500',
              rejected: 'bg-red-500/10 text-red-500',
            };

            return (
              <button
                key={report.id}
                onClick={() => openReport(report)}
                className="w-full text-left border bg-card p-4 hover:bg-surface-2/60 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{report.title}</h3>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 uppercase ${statusColors[report.status]}`}>
                        {report.status}
                      </span>
                    </div>
                    {report.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{report.description}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {report.items.length} item{report.items.length !== 1 ? 's' : ''}
                      {' · '}Updated {formatDate(report.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold tabnum">{formatCurrency(report.totalAmount)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/30 group-hover:text-primary transition-colors">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Add Transactions Sub-View ────────────────
function AddTransactionsView({
  report,
  getDisplayName,
  onDone,
  onBack,
}: {
  report: ExpenseReport;
  getDisplayName: (name: string) => string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const { data: categories } = useCategories();

  const existingTxIds = new Set(report.items.map(i => i.transactionId));

  const datePresets = PERIOD_OPTIONS.map(p => {
    const range = getPeriodRange(p)!;
    return { label: getPeriodLabel(p), ...range };
  });

  const applyPreset = (label: string, from: string, to: string) => {
    if (activePreset === label) {
      setActivePreset(null); setDateFrom(''); setDateTo('');
    } else {
      setActivePreset(label); setDateFrom(from); setDateTo(to);
    }
  };

  const { data, isLoading } = useFetch(
    () => transactionsApi.list({
      limit: 200, sort: 'date', order: 'desc',
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      category: filterCategory || undefined,
    }),
    [search, dateFrom, dateTo, filterCategory]
  );

  const transactions: Transaction[] = (data?.transactions || []).filter(
    (t: Transaction) => !existingTxIds.has(t.id)
  );

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    await expenseReportsApi.addItems(report.id, [...selectedIds]);
    setAdding(false);
    onDone();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <h2 className="text-lg font-bold">Add to: {report.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-xs font-mono text-primary">{selectedIds.size} selected</span>
          )}
          <Button size="sm" onClick={handleAdd} disabled={selectedIds.size === 0 || adding}>
            {adding ? 'Adding...' : `Add ${selectedIds.size || ''} to Report`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        >
          <option value="">All categories</option>
          {categories?.filter(c => c.type === 'expense').map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
          {categories?.filter(c => c.type === 'income').map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Date presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {datePresets.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.label, p.from, p.to)}
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
      </div>

      {isLoading ? (
        <PageLoader message="Loading transactions..." />
      ) : transactions.length === 0 ? (
        <EmptyState title="No transactions found" description={search ? 'Try a different search' : 'All transactions are already in this report'} />
      ) : (
        <div className="border border-border bg-surface-1 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="w-10 px-3 py-2.5"></th>
                <th className="text-left px-3 py-2.5 ticker">Date</th>
                <th className="text-left px-3 py-2.5 ticker">Description</th>
                <th className="text-left px-3 py-2.5 ticker">Category</th>
                <th className="text-left px-3 py-2.5 ticker">Account</th>
                <th className="text-right px-3 py-2.5 ticker">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    'border-b border-border last:border-0 cursor-pointer transition-colors',
                    selectedIds.has(t.id) ? 'bg-primary/5' : 'hover:bg-surface-2/60',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggle(t.id)}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabnum font-mono text-xs">{formatDate(t.date)}</td>
                  <td className="px-3 py-2.5 text-xs max-w-[250px] truncate">{t.description}</td>
                  <td className="px-3 py-2.5"><CategoryBadge category={t.category} /></td>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{getDisplayName(t.account)}</td>
                  <td className="px-3 py-2.5 text-right"><Amount value={t.amount} size="sm" showSign /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
