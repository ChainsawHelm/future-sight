'use client';

import { useState, useCallback } from 'react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { assetsApi, debtsApi, networthApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import type { Asset, Debt, NetWorthSnapshot } from '@/types/models';

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

  const typeIcons: Record<string, string> = {
    checking: '🏦', savings: '💰', investment: '📈', retirement: '🏖️',
    property: '🏠', vehicle: '🚗', other: '📦',
  };

  if (isLoading) return <PageLoader message="Loading net worth..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Net Worth</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your assets and liabilities</p>
        </div>
        <Button onClick={handleSnapshot} variant="outline" size="sm" disabled={takeSnapshot.isLoading}>
          📸 Take Snapshot
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Assets" value={totalAssets} trend="up" />
        <StatCard title="Total Liabilities" value={totalLiabilities} trend="down" />
        <StatCard title="Net Worth" value={netWorth} trend={netWorth >= 0 ? 'up' : 'down'} />
      </div>

      {/* Assets list */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Assets</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddAsset(!showAddAsset)}>
            {showAddAsset ? 'Cancel' : '+ Add'}
          </Button>
        </div>

        {showAddAsset && (
          <form onSubmit={handleAddAsset} className="flex flex-wrap gap-3 mb-4 pb-4 border-b">
            <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="flex-1 min-w-[150px] h-9 text-sm" />
            <Input type="number" step="0.01" placeholder="Value" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} required className="w-32 h-9 text-sm" />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className="h-9 rounded-lg border bg-background px-3 text-sm">
              {Object.entries(typeIcons).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
            <Button type="submit" size="sm" className="bg-navy-500 hover:bg-navy-600">Add</Button>
          </form>
        )}

        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No assets added yet</p>
        ) : (
          <div className="space-y-2">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 px-1">
                <div className="flex items-center gap-2">
                  <span>{typeIcons[a.type] || '📦'}</span>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{a.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabnum">{formatCurrency(a.value)}</span>
                  <button onClick={() => handleDeleteAsset(a.id)} className="text-muted-foreground/30 hover:text-red-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot history */}
      {snapshots.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Net Worth History</h2>
          <div className="space-y-2">
            {snapshots.slice().reverse().slice(0, 12).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground text-xs tabnum">{s.date}</span>
                <span className={`font-semibold tabnum ${s.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
