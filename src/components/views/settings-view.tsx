'use client';

import { useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { settingsApi, backupApi } from '@/lib/api-client';
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
    id: 'glasshouse',
    name: 'Glasshouse',
    desc: 'Warm sage & terracotta',
    colors: ['#F6F3EE', '#1F2A2E', '#8FBC8F', '#B8C8B1', '#B26E4A'],
  },
  {
    id: 'studio-minimal',
    name: 'Studio Minimal',
    desc: 'Cool white & ink black',
    colors: ['#F9FAFB', '#111827', '#8FBC8F', '#CBD5E1', '#9CA3AF'],
  },
  {
    id: 'studio-warm',
    name: 'Studio Warm',
    desc: 'Sandy off-white & clay',
    colors: ['#FAF8F5', '#111827', '#8FBC8F', '#D4B896', '#C1825E'],
  },
];

export function SettingsView() {
  const { data, error, isLoading, refetch } = useFetch<{ settings: UserSettings }>(() => settingsApi.get(), []);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [activeTheme, setActiveTheme] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('fs-theme') || 'glasshouse' : 'glasshouse'
  );

  const updateSettings = useMutation(useCallback((d: any) => settingsApi.update(d), []));

  const applyTheme = (id: string) => {
    setActiveTheme(id);
    localStorage.setItem('fs-theme', id);
    if (id === 'glasshouse') {
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
                className={`relative text-left p-3 rounded-lg border-2 transition-all ${
                  activeTheme === t.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-surface-2 hover:border-primary/40'
                }`}
              >
                {activeTheme === t.id && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>
                  </span>
                )}
                <div className="flex gap-1 mb-2">
                  {t.colors.map((c, i) => (
                    <span key={i} className="w-5 h-5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: c }} />
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
    </div>
  );
}
