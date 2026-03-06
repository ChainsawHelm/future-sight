'use client';

import { useFetch } from '@/hooks/use-fetch';
import { dashboardApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { cn } from '@/lib/utils';

// ─── ASCII Art Icons ──────────────────────────────────────────────────────────

const ASCII_ICONS: Record<string, string> = {
  first_import: [
    '  ┌───┐ ',
    '  │ ▼ │ ',
    '  └─┬─┘ ',
    ' ───┴───',
  ].join('\n'),

  txn_100: [
    ' ╔═══╗ ',
    ' ║100║ ',
    ' ╚═══╝ ',
    '  ▓▓▓  ',
  ].join('\n'),

  txn_500: [
    '   ╱╲   ',
    '  ╱  ╲  ',
    ' ╱ ★★ ╲ ',
    ' ╲ 500╱ ',
    '  ╲  ╱  ',
    '   ╲╱   ',
  ].join('\n'),

  positive_month: [
    '   ┌─┐  ',
    '   │$│  ',
    ' ──┤ ├──',
    '   │+│  ',
    '   └─┘  ',
  ].join('\n'),

  savings_10pct: [
    '  ╭───╮ ',
    '  │10%│ ',
    ' ╭┤   ├╮',
    ' │╰───╯│',
    ' ╰─────╯',
  ].join('\n'),

  savings_20pct: [
    ' ┌─────┐',
    ' │ $$$ │',
    ' │ 20% │',
    ' │ $$$ │',
    ' └─────┘',
  ].join('\n'),

  debt_free: [
    '  ╔═══╗ ',
    '  ║ 0 ║ ',
    '  ║   ║ ',
    '  ╚═╤═╝ ',
    ' ───┴───',
    '  FREE! ',
  ].join('\n'),

  goal_complete: [
    '    ◎    ',
    '   ╱│╲   ',
    '  ╱ │ ╲  ',
    ' ╱  │  ╲ ',
    ' ‾‾‾‾‾‾‾',
  ].join('\n'),

  budget_master: [
    ' ┌──┬──┐',
    ' │▓▓│░░│',
    ' │▓▓│░░│',
    ' │▓▓│  │',
    ' └──┴──┘',
  ].join('\n'),

  net_worth_positive: [
    '      ╱ ',
    '    ╱   ',
    '  ╱     ',
    ' ╱   +$ ',
    ' ───────',
  ].join('\n'),

  diversified: [
    '  ╱▓╲   ',
    ' ╱▓▓▓╲  ',
    ' ──┬──  ',
    ' ░░│▒▒  ',
    ' ░░│▒▒  ',
  ].join('\n'),

  streak_7: [
    ' ╔═╦═╦═╗',
    ' ║█║█║█║',
    ' ╠═╬═╬═╣',
    ' ║█║█║█║',
    ' ╚═╩═╩═╝',
    '  7 DAYS ',
  ].join('\n'),
};

// ─── Achievement Definitions ──────────────────────────────────────────────────

interface AchievementDef {
  key: string;
  title: string;
  description: string;
  check: (ctx: any) => boolean;
}

const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_import', title: 'INIT_COMPLETE', description: 'Import your first transactions', check: (c) => c.totalTxns > 0 },
  { key: 'txn_100', title: 'CENTURY_LOG', description: 'Track 100 transactions', check: (c) => c.totalTxns >= 100 },
  { key: 'txn_500', title: 'DATA_HOARDER', description: 'Track 500 transactions', check: (c) => c.totalTxns >= 500 },
  { key: 'positive_month', title: 'GREEN_STATUS', description: 'Finish a month with positive savings', check: (c) => c.netSavings > 0 },
  { key: 'savings_10pct', title: 'PENNY_DAEMON', description: 'Save 10% of your income in a month', check: (c) => c.savingsRate >= 0.1 },
  { key: 'savings_20pct', title: 'SUPER_SAVER', description: 'Save 20% of your income in a month', check: (c) => c.savingsRate >= 0.2 },
  { key: 'debt_free', title: 'ZERO_BALANCE', description: 'Pay off all debts', check: (c) => c.totalDebts === 0 && c.hasDebts },
  { key: 'goal_complete', title: 'TARGET_HIT', description: 'Complete a savings goal', check: (c) => c.completedGoals > 0 },
  { key: 'budget_master', title: 'BUDGET_ROOT', description: 'Stay under budget in all categories', check: (c) => c.allOnBudget },
  { key: 'net_worth_positive', title: 'NET_POSITIVE', description: 'Achieve a positive net worth', check: (c) => c.netWorth > 0 },
  { key: 'diversified', title: 'MULTI_THREAD', description: 'Track 3+ asset types', check: (c) => c.assetTypes >= 3 },
  { key: 'streak_7', title: 'UPTIME_7D', description: 'Track spending for 7 consecutive days', check: (c) => c.streak >= 7 },
];

// ─── Achievement Card ─────────────────────────────────────────────────────────

function AchievementCard({ achievement, unlocked }: { achievement: AchievementDef; unlocked: boolean }) {
  const ascii = ASCII_ICONS[achievement.key] || '  [?]  ';

  return (
    <div className={cn(
      'border bg-surface-1 overflow-hidden transition-all',
      unlocked
        ? 'border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.08)]'
        : 'border-border opacity-40',
    )}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-2">
        <span className="text-[9px] font-mono tracking-[0.1em] text-primary/60 uppercase">
          [{unlocked ? 'UNLOCKED' : 'LOCKED'}]
        </span>
        <span className={cn(
          'text-[9px] font-mono',
          unlocked ? 'text-income' : 'text-muted-foreground/40',
        )}>
          {unlocked ? '● ACTIVE' : '○ INACTIVE'}
        </span>
      </div>

      <div className="p-4 flex gap-4">
        {/* ASCII art icon */}
        <div className={cn(
          'shrink-0 flex items-center justify-center',
          'border border-border bg-surface-2 p-2',
          unlocked && 'border-primary/20',
        )}>
          <pre className={cn(
            'text-[8px] leading-[10px] font-mono select-none whitespace-pre',
            unlocked ? 'text-primary' : 'text-muted-foreground/30',
          )}>
            {ascii}
          </pre>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs font-bold font-mono tracking-wider',
            unlocked ? 'text-primary' : 'text-muted-foreground',
          )}>
            {achievement.title}
          </p>
          <p className="ticker text-[10px] mt-1">
            {achievement.description}
          </p>
          {unlocked && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-income tracking-wider">[COMPLETE]</span>
              <div className="flex-1 h-px bg-income/20" />
            </div>
          )}
          {!unlocked && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-muted-foreground/40 tracking-wider">[PENDING]</span>
              <div className="flex-1 h-line" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
    allOnBudget: false,
    netWorth: overview.netWorth,
    assetTypes: new Set(txns.map((t: any) => t.account)).size,
    streak: 0,
  };

  // Calculate streak
  const dates = [...new Set(txns.map((t: any) => t.date))].sort().reverse();
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
  const progress = (unlocked.length / ACHIEVEMENTS.length) * 100;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="ticker mb-1">System Achievements</p>
            <h1 className="text-xl font-bold tracking-tight">
              {unlocked.length}<span className="text-muted-foreground font-normal">/{ACHIEVEMENTS.length}</span>
              <span className="text-muted-foreground font-normal text-sm ml-2">unlocked</span>
            </h1>
          </div>
          <div className="text-right">
            <p className="ticker mb-1">Completion</p>
            <p className={cn('numeral font-bold text-lg tabnum', progress === 100 && 'text-income')}>
              {progress.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{
                width: `${progress}%`,
                boxShadow: '0 0 8px hsl(var(--primary) / 0.4)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] font-mono text-muted-foreground">0%</span>
            <span className="text-[8px] font-mono text-muted-foreground">100%</span>
          </div>
        </div>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="ticker text-income">[UNLOCKED]</span>
            <div className="flex-1 h-px bg-income/20" />
            <span className="ticker text-income">{unlocked.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unlocked.map(a => (
              <AchievementCard key={a.key} achievement={a} unlocked />
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="ticker text-muted-foreground">[LOCKED]</span>
            <div className="flex-1 h-line" />
            <span className="ticker text-muted-foreground">{locked.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {locked.map(a => (
              <AchievementCard key={a.key} achievement={a} unlocked={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
