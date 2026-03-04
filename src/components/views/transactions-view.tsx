'use client';

import { useState, useCallback } from 'react';
import { useTransactions, useCategories } from '@/hooks/use-data';
import { useMutation } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { TransactionTableSkeleton } from '@/components/shared/skeletons';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryBadge } from '@/components/shared/category-badge';
import { Amount } from '@/components/shared/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatDate } from '@/lib/utils';
import type { TransactionQuery, Transaction } from '@/types/models';

export function TransactionsView() {
  const [query, setQuery] = useState<TransactionQuery>({
    page: 1,
    limit: 50,
    sort: 'date',
    order: 'desc',
  });
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAccount, setFilterAccount] = useState('');

  const { data, error, isLoading, refetch } = useTransactions({
    ...query,
    search: search || undefined,
    category: filterCategory || undefined,
    account: filterAccount || undefined,
  });
  const { data: categories } = useCategories();

  const updateMutation = useMutation(
    useCallback(({ id, data }: { id: string; data: any }) => transactionsApi.update(id, data), [])
  );
  const bulkDeleteMutation = useMutation(
    useCallback((ids: string[]) => transactionsApi.bulkDelete(ids), [])
  );
  const bulkUpdateMutation = useMutation(
    useCallback(({ ids, update }: { ids: string[]; update: any }) => transactionsApi.bulkUpdate(ids, update), [])
  );

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

  // Get unique accounts for filter
  const accounts = [...new Set(transactions.map((t) => t.account))].sort();

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

  const toggleSort = (field: TransactionQuery['sort']) => {
    setQuery((q) => ({
      ...q,
      sort: field,
      order: q.sort === field && q.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (query.sort !== field) return null;
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline ml-1">
        <path d={query.order === 'asc' ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
      </svg>
    );
  };

  if (isLoading && !data) return <TransactionTableSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total.toLocaleString()} total
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setQuery((q) => ({ ...q, page: 1 })); }}
            className="pl-9 h-9"
          />
        </div>

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setQuery((q) => ({ ...q, page: 1 })); }}
          className="h-9 rounded-lg border bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Account filter */}
        {accounts.length > 1 && (
          <select
            value={filterAccount}
            onChange={(e) => { setFilterAccount(e.target.value); setQuery((q) => ({ ...q, page: 1 })); }}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-navy-50 dark:bg-navy-900/30 border border-navy-200 dark:border-navy-800 px-4 py-2 animate-slide-down">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <select
            onChange={(e) => { if (e.target.value) handleBulkRecategorize(e.target.value); e.target.value = ''; }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            defaultValue=""
          >
            <option value="" disabled>Recategorize...</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            Delete
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:underline">
            Clear
          </button>
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
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === transactions.length && transactions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('date')}>
                    Date <SortIcon field="date" />
                  </th>
                  <th className="text-left px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('description')}>
                    Description <SortIcon field="description" />
                  </th>
                  <th className="text-left px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('category')}>
                    Category <SortIcon field="category" />
                  </th>
                  <th className="text-left px-3 py-3">Account</th>
                  <th className="text-right px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                    Amount <SortIcon field="amount" />
                  </th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className={cn(
                      'border-b last:border-0 transition-colors hover:bg-muted/20',
                      t.flagged && 'bg-yellow-50/50 dark:bg-yellow-900/10',
                      selectedIds.has(t.id) && 'bg-navy-50/50 dark:bg-navy-900/20'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground tabnum text-xs">
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
                        <button
                          onClick={() => startEdit(t)}
                          className="text-left truncate block max-w-full hover:text-navy-500 transition-colors"
                          title={t.originalDescription || t.description}
                        >
                          {t.description}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {editingId === t.id ? (
                        <select
                          value={editFields.category || ''}
                          onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))}
                          className="h-7 rounded border bg-background px-2 text-xs"
                        >
                          {categories?.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <CategoryBadge category={t.category} />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{t.account}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Amount value={t.amount} size="sm" showSign />
                    </td>
                    <td className="px-3 py-2.5">
                      {editingId === t.id ? (
                        <div className="flex gap-1">
                          <button onClick={saveEdit} className="text-green-600 hover:text-green-700" title="Save">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                          </button>
                          <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground" title="Cancel">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(t)}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
