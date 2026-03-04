'use client';

import { useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { settingsApi, backupApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserSettings } from '@/types/models';

export function SettingsView() {
  const { data, error, isLoading, refetch } = useFetch<{ settings: UserSettings }>(() => settingsApi.get(), []);
  const [restoreStatus, setRestoreStatus] = useState('');

  const updateSettings = useMutation(useCallback((d: any) => settingsApi.update(d), []));

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
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Dark Mode</p>
            <p className="text-xs text-muted-foreground">Easier on the eyes at night</p>
          </div>
          <button
            onClick={() => toggle('darkMode', !settings.darkMode)}
            className={`w-11 h-6 rounded-full transition-colors duration-200 ${settings.darkMode ? 'bg-navy-500' : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${settings.darkMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold">Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Budget Rollover</p>
            <p className="text-xs text-muted-foreground">Carry unspent budget to next month</p>
          </div>
          <button
            onClick={() => toggle('budgetRollover', !settings.budgetRollover)}
            className={`w-11 h-6 rounded-full transition-colors duration-200 ${settings.budgetRollover ? 'bg-navy-500' : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${settings.budgetRollover ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold">Data Management</h2>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExport}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export Backup
          </Button>
          <label>
            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
            <span className="inline-flex items-center px-4 py-2 rounded-lg border bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Restore Backup
            </span>
          </label>
        </div>
        {restoreStatus && <p className="text-xs text-muted-foreground">{restoreStatus}</p>}
      </div>

      {/* Account */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold">Account</h2>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
