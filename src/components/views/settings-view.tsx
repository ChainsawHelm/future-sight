'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { settingsApi, backupApi, resetApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import type { UserSettings } from '@/types/models';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 transition-colors duration-200 ${on ? 'bg-primary' : 'bg-surface-3 border border-border'}`}
      style={{ boxShadow: on ? '0 0 8px hsl(var(--primary) / 0.3)' : undefined }}
    >
      <div className={`absolute top-0.5 w-5 h-5 bg-white transition-transform duration-200 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

const THEMES = [
  {
    id: 'default',
    name: 'Phosphor Green',
    desc: 'Classic CRT terminal',
    colors: ['#0a1a0a', '#33ff33', '#1a3a1a', '#00cc44', '#005500'],
  },
  {
    id: 'amber',
    name: 'Amber CRT',
    desc: 'Warm amber monochrome',
    colors: ['#0d0a04', '#e6a000', '#2a1f0a', '#cc8800', '#664400'],
  },
  {
    id: 'blue',
    name: 'Cool Blue',
    desc: 'IBM mainframe style',
    colors: ['#040810', '#4d9eff', '#0a1428', '#3377cc', '#1a3366'],
  },
  {
    id: 'pink',
    name: 'Hot Pink',
    desc: 'Cyberpunk terminal',
    colors: ['#0d040a', '#ff4da6', '#280a1a', '#cc3388', '#661a44'],
  },
  {
    id: 'arctic',
    name: 'Arctic White',
    desc: 'Monochrome grayscale',
    colors: ['#080808', '#cccccc', '#141414', '#999999', '#444444'],
  },
  {
    id: 'matrix',
    name: 'Matrix',
    desc: 'Pure black, bright green',
    colors: ['#020202', '#00ff00', '#001a00', '#00cc00', '#004400'],
  },
];

export function SettingsView() {
  const { data, error, isLoading, refetch } = useFetch<{ settings: UserSettings }>(() => settingsApi.get(), []);
  const router = useRouter();
  const [restoreStatus, setRestoreStatus] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState<{ transactions: number; plaidConnections: number } | null>(null);
  const [activeTheme, setActiveTheme] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('fs-theme') || 'default' : 'default'
  );

  const updateSettings = useMutation(useCallback((d: any) => settingsApi.update(d), []));

  const applyTheme = (id: string) => {
    setActiveTheme(id);
    localStorage.setItem('fs-theme', id);
    if (id === 'default') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = id;
    }
  };
  const settings = data?.settings;

  const toggle = async (key: keyof UserSettings, value: boolean) => {
    await updateSettings.mutate({ [key]: value });
    if (key === 'darkMode') {
      document.documentElement.classList.toggle('dark', value);
    }
    refetch();
  };

  const handleExport = async () => {
    try {
      const backup = await backupApi.export();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `futuresight-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreStatus('Restoring...');
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const result = await backupApi.restore(backup);
      setRestoreStatus(`Restored: ${JSON.stringify(result.counts)}`);
      refetch();
    } catch (err: any) {
      setRestoreStatus('Restore failed: ' + err.message);
    }
    e.target.value = '';
  };

  const handleReset = async () => {
    if (resetConfirm !== 'RESET') return;
    setResetting(true);
    try {
      const result = await resetApi.resetTransactionData();
      setResetDone(result.deleted);
      setResetConfirm('');
    } catch (err: any) {
      alert('Reset failed: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleGoToImport = () => {
    setShowResetModal(false);
    setResetDone(null);
    // Hard navigate so all stale in-memory data is cleared
    window.location.href = '/import';
  };

  const handleCloseAfterReset = () => {
    setShowResetModal(false);
    setResetDone(null);
    window.location.reload();
  };

  if (isLoading) return <PageLoader message="Loading settings..." />;
  if (error) return <ErrorAlert message={error} />;
  if (!settings) return null;

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Preferences</p>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Appearance */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <p className="ticker text-primary">Appearance</p>
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-semibold">Dark Mode</p>
            <p className="ticker mt-0.5">Easier on the eyes at night</p>
          </div>
          <Toggle on={settings.darkMode} onToggle={() => toggle('darkMode', !settings.darkMode)} />
        </div>
        <div>
          <p className="text-sm font-semibold mb-3">Color Theme</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                className={`relative text-left p-3 border-2 transition-all ${
                  activeTheme === t.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-surface-2 hover:border-primary/40'
                }`}
              >
                {activeTheme === t.id && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-primary flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>
                  </span>
                )}
                <div className="flex gap-1 mb-2">
                  {t.colors.map((c, i) => (
                    <span key={i} className="w-5 h-5 border border-black/10 shrink-0" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs font-semibold">{t.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <p className="ticker text-primary">Budget</p>
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-semibold">Budget Rollover</p>
            <p className="ticker mt-0.5">Carry unspent budget to next month</p>
          </div>
          <Toggle on={settings.budgetRollover} onToggle={() => toggle('budgetRollover', !settings.budgetRollover)} />
        </div>
      </div>

      {/* Data Management */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <p className="ticker text-primary">Data Management</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 h-9 px-4 border border-border bg-surface-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export Backup
          </button>
          <label>
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
            <span className="flex items-center gap-2 h-9 px-4 border border-border bg-surface-2 text-sm font-medium cursor-pointer hover:border-primary/50 hover:text-primary transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Restore Backup
            </span>
          </label>
        </div>
        {restoreStatus && <p className="ticker mt-1">{restoreStatus}</p>}
      </div>

      {/* Account */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <p className="ticker text-primary">Account</p>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 h-9 px-4 border border-expense/30 bg-expense/5 text-expense text-sm font-medium hover:bg-expense/10 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border border-expense/30 bg-expense/5 p-5 space-y-3">
        <p className="ticker text-expense">Danger Zone</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Start fresh</p>
            <p className="ticker mt-0.5">Wipes all transaction data and bank connections so you can re-import from scratch. Your goals, debts, assets, and budgets are preserved.</p>
          </div>
          <button
            onClick={() => { setShowResetModal(true); setResetDone(null); setResetConfirm(''); }}
            className="shrink-0 flex items-center gap-2 h-9 px-4 border border-expense/40 bg-expense/10 text-expense text-sm font-semibold hover:bg-expense/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Wipe &amp; Restart
          </button>
        </div>
      </div>

      {/* Reset modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 border border-border bg-card p-6 shadow-xl space-y-4">

            {resetDone ? (
              /* ── Success state ── */
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-income/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Data cleared</p>
                    <p className="ticker mt-0.5">{resetDone.transactions} transactions and {resetDone.plaidConnections} bank connection{resetDone.plaidConnections !== 1 ? 's' : ''} removed.</p>
                  </div>
                </div>

                <div className="bg-surface-2 border border-border p-3 text-xs text-muted-foreground">
                  Head to <span className="font-semibold text-foreground">Import</span> to upload a CSV or PDF, or reconnect your bank via Plaid.
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCloseAfterReset}
                    className="flex-1 h-9 border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleGoToImport}
                    className="flex-1 h-9 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Go to Import →
                  </button>
                </div>
              </>
            ) : (
              /* ── Confirmation state ── */
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-expense/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-expense" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">This cannot be undone</p>
                    <p className="ticker mt-0.5">All transaction history will be permanently deleted.</p>
                  </div>
                </div>

                <div className="bg-surface-2 border border-border p-3 space-y-1 text-xs font-mono">
                  <p className="text-expense font-semibold">Deletes:</p>
                  <p className="text-muted-foreground">· All transactions &amp; import history</p>
                  <p className="text-muted-foreground">· Bank connections (Plaid)</p>
                  <p className="text-muted-foreground">· Net worth snapshots</p>
                  <p className="text-income font-semibold mt-2">Keeps:</p>
                  <p className="text-muted-foreground">· Goals, debts &amp; assets</p>
                  <p className="text-muted-foreground">· Budgets, categories &amp; calendar</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Type <span className="font-mono font-bold text-expense">RESET</span> to confirm
                  </p>
                  <input
                    type="text"
                    value={resetConfirm}
                    onChange={e => setResetConfirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="RESET"
                    autoFocus
                    className="w-full h-9 px-3 border border-border bg-surface-2 text-sm font-mono focus:outline-none focus:border-expense placeholder:text-muted-foreground/40"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowResetModal(false); setResetConfirm(''); }}
                    className="flex-1 h-9 border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={resetConfirm !== 'RESET' || resetting}
                    className="flex-1 h-9 border border-expense/40 bg-expense text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-expense/90 transition-colors"
                  >
                    {resetting ? 'Deleting...' : 'Delete Everything'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
