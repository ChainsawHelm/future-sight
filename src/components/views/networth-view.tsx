'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { assetsApi, debtsApi, networthApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import type { Asset, Debt, NetWorthSnapshot } from '@/types/models';

const TYPE_LABELS: Record<string, string> = {
  checking: 'Checking', savings: 'Savings', investment: 'Investment',
  retirement: 'Retirement', property: 'Property', vehicle: 'Vehicle', other: 'Other',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  checking: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  savings: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  investment: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  retirement: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  property: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  vehicle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  other: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

export function NetWorthView() {
  const { data: assetsData, refetch: refetchAssets } = useFetch<{ assets: Asset[] }>(() => assetsApi.list(), []);
  const { data: debtsData } = useFetch<{ debts: Debt[] }>(() => debtsApi.list(), []);
  const { data: snapsData, isLoading, error, refetch } = useFetch<{ snapshots: NetWorthSnapshot[] }>(() => networthApi.list(), []);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [form, setForm] = useState({ name: '', value: '', type: 'checking' as Asset['type'] });

  const createAsset = useMutation(useCallback((d: any) => assetsApi.create(d), []));
  const deleteAsset = useMutation(useCallback((id: string) => assetsApi.delete(id), []));
  const takeSnapshot = useMutation(useCallback((d: any) => networthApi.create(d), []));

  const assets = assetsData?.assets || [];
  const debts = debtsData?.debts || [];
  const snapshots = snapsData?.snapshots || [];

  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = debts.reduce((s, d) => s + d.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAsset.mutate({ name: form.name, value: parseFloat(form.value), type: form.type });
    setForm({ name: '', value: '', type: 'checking' });
    setShowAddAsset(false);
    refetchAssets();
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Delete this asset?')) return;
    await deleteAsset.mutate(id);
    refetchAssets();
  };

  const handleSnapshot = async () => {
    await takeSnapshot.mutate({
      date: new Date().toISOString().slice(0, 10),
      assets: totalAssets,
      liabilities: totalLiabilities,
      netWorth,
    });
    refetch();
  };

  if (isLoading) return <PageLoader message="Loading net worth..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="ticker mb-1">Balance Sheet</p>
            <h1 className="text-xl font-bold tracking-tight">Net Worth</h1>
          </div>
          <button
            onClick={handleSnapshot}
            disabled={takeSnapshot.isLoading}
            className="h-9 px-4 border border-border bg-surface-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-40"
          >
            Take Snapshot
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Total Assets" value={totalAssets} trend="up" index={0} />
        <StatCard title="Total Liabilities" value={totalLiabilities} trend="down" index={1} />
        <StatCard title="Net Worth" value={netWorth} trend={netWorth >= 0 ? 'up' : 'down'} index={2} />
      </div>

      {/* Assets */}
      <div className="border border-border bg-surface-1 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="ticker">Assets</p>
          <button
            onClick={() => setShowAddAsset(!showAddAsset)}
            className="ticker text-primary hover:text-primary/80 transition-colors"
          >
            {showAddAsset ? '✕ Cancel' : '+ Add Asset'}
          </button>
        </div>

        {showAddAsset && (
          <form onSubmit={handleAddAsset} className="flex flex-wrap gap-3 px-5 py-4 border-b border-border bg-surface-2">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="flex-1 min-w-[150px] h-9 text-sm" />
            <Input type="number" step="0.01" placeholder="Value" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} required className="w-32 h-9 text-sm" />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
              className="h-9 border border-border bg-surface-1 px-3 text-sm font-mono focus:outline-none focus:border-primary">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="submit"
              className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors shadow-[0_0_12px_hsl(var(--primary)/0.2)]">
              Add
            </button>
          </form>
        )}

        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 font-mono">No assets added yet</p>
        ) : (
          <div className="divide-y divide-border">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-2/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 flex items-center justify-center bg-surface-3 text-muted-foreground shrink-0">
                    {TYPE_ICONS[a.type]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="ticker">{TYPE_LABELS[a.type]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="numeral text-sm font-bold tabnum text-primary">{formatCurrency(a.value)}</span>
                  <button onClick={() => handleDeleteAsset(a.id)} className="text-muted-foreground/30 hover:text-expense transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot history */}
      {snapshots.length > 0 && (
        <div className="border border-border bg-surface-1 overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="ticker">Net Worth History</p>
          </div>
          <div className="divide-y divide-border">
            {snapshots.slice().reverse().slice(0, 12).map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-2.5">
                <span className="ticker">{s.date}</span>
                <span className={`numeral text-sm font-bold tabnum ${s.netWorth >= 0 ? 'text-primary' : 'text-expense'}`}>
                  {formatCurrency(s.netWorth)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
