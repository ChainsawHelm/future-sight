'use client';

import { useFetch } from '@/hooks/use-fetch';
import { dashboardApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { cn } from '@/lib/utils';

interface AchievementDef {
  key: string;
  icon: string;
  title: string;
  description: string;
  check: (ctx: any) => boolean;
}

const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_import', icon: '📥', title: 'Getting Started', description: 'Import your first transactions', check: (c) => c.totalTxns > 0 },
  { key: 'txn_100', icon: '💯', title: 'Century', description: 'Track 100 transactions', check: (c) => c.totalTxns >= 100 },
  { key: 'txn_500', icon: '🏅', title: 'Dedicated Tracker', description: 'Track 500 transactions', check: (c) => c.totalTxns >= 500 },
  { key: 'positive_month', icon: '💚', title: 'In the Green', description: 'Finish a month with positive savings', check: (c) => c.netSavings > 0 },
  { key: 'savings_10pct', icon: '🐷', title: 'Penny Pincher', description: 'Save 10% of your income in a month', check: (c) => c.savingsRate >= 0.1 },
  { key: 'savings_20pct', icon: '💰', title: 'Super Saver', description: 'Save 20% of your income in a month', check: (c) => c.savingsRate >= 0.2 },
  { key: 'debt_free', icon: '🎉', title: 'Debt Free!', description: 'Pay off all debts', check: (c) => c.totalDebts === 0 && c.hasDebts },
  { key: 'goal_complete', icon: '🎯', title: 'Goal Getter', description: 'Complete a savings goal', check: (c) => c.completedGoals > 0 },
  { key: 'budget_master', icon: '📊', title: 'Budget Master', description: 'Stay under budget in all categories', check: (c) => c.allOnBudget },
  { key: 'net_worth_positive', icon: '📈', title: 'Net Positive', description: 'Achieve a positive net worth', check: (c) => c.netWorth > 0 },
  { key: 'diversified', icon: '🌐', title: 'Diversified', description: 'Track 3+ asset types', check: (c) => c.assetTypes >= 3 },
  { key: 'streak_7', icon: '🔥', title: 'Week Streak', description: 'Track spending for 7 consecutive days', check: (c) => c.streak >= 7 },
];

export function AchievementsView() {
  const { data: dash, isLoading: l1 } = useFetch(() => dashboardApi.get(), []);
  const { data: txnData, isLoading: l2 } = useFetch(() => transactionsApi.list({ limit: 200 }), []);

  if (l1 || l2) return <PageLoader message="Checking achievements..." />;

  const overview = dash?.overview || { totalTransactions: 0, monthlyIncome: 0, netSavings: 0, totalDebts: 0, netWorth: 0, totalAssets: 0 };
  const goals = dash?.goals || [];
  const debts = dash?.debts || [];
  const txns = txnData?.transactions || [];

  // Build context for achievement checks
  const ctx = {
    totalTxns: overview.totalTransactions,
    netSavings: overview.netSavings,
    savingsRate: overview.monthlyIncome > 0 ? overview.netSavings / overview.monthlyIncome : 0,
    totalDebts: overview.totalDebts,
    hasDebts: debts.length > 0,
    completedGoals: goals.filter((g: any) => g.progress >= 1).length,
    allOnBudget: false, // Would need budget data — simplified
    netWorth: overview.netWorth,
    assetTypes: new Set(txns.map(t => t.account)).size,
    streak: 0, // Simplified
  };

  // Calculate streak
  const dates = [...new Set(txns.map(t => t.date))].sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (dates.includes(ds)) streak++;
    else if (i > 0) break;
  }
  ctx.streak = streak;

  const unlocked = ACHIEVEMENTS.filter(a => a.check(ctx));
  const locked = ACHIEVEMENTS.filter(a => !a.check(ctx));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Achievements</h1>
        <p className="text-sm text-muted-foreground mt-1">{unlocked.length} of {ACHIEVEMENTS.length} unlocked</p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Progress</span>
          <span className="tabnum">{unlocked.length}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-green-600">✓ Unlocked</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unlocked.map(a => (
              <div key={a.key} className="rounded-xl border bg-card p-4 shadow-sm border-green-200 dark:border-green-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{a.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">🔒 Locked</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locked.map(a => (
              <div key={a.key} className="rounded-xl border bg-card p-4 shadow-sm opacity-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl grayscale">{a.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
