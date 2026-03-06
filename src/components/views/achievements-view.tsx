'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { ALL_ACHIEVEMENTS, CATEGORY_LABELS, TIER_LABELS } from '@/lib/achievements';
import type { AchievementDef } from '@/lib/achievements';
import { cn } from '@/lib/utils';

const TIER_COLORS = ['', 'text-amber-600', 'text-slate-400', 'text-yellow-400', 'text-cyan-300', 'text-fuchsia-300'];
const TIER_BG = ['', 'bg-amber-600/10', 'bg-slate-400/10', 'bg-yellow-400/10', 'bg-cyan-300/10', 'bg-fuchsia-300/10'];
const TIER_BORDER = ['', 'border-amber-600/30', 'border-slate-400/30', 'border-yellow-400/30', 'border-cyan-300/30', 'border-fuchsia-300/30'];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

// ─── Achievement Card ─────────────────────────────────────────────────────────

function AchievementCard({ a, unlocked }: { a: AchievementDef; unlocked: boolean }) {
  return (
    <div className={cn(
      'border bg-surface-1 overflow-hidden transition-all',
      unlocked
        ? `${TIER_BORDER[a.tier]} shadow-[0_0_10px_hsl(var(--primary)/0.06)]`
        : 'border-border opacity-35',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-border bg-surface-2">
        <span className={cn('text-[8px] font-mono tracking-[0.1em] uppercase',
          unlocked ? TIER_COLORS[a.tier] : 'text-muted-foreground/40'
        )}>
          {TIER_LABELS[a.tier]}
        </span>
        <span className={cn('text-[8px] font-mono',
          unlocked ? 'text-income' : 'text-muted-foreground/30'
        )}>
          {unlocked ? '●' : '○'}
        </span>
      </div>

      <div className="p-3 flex gap-3">
        {/* ASCII art */}
        <div className={cn(
          'shrink-0 border p-1.5 flex items-center justify-center',
          unlocked ? `${TIER_BORDER[a.tier]} ${TIER_BG[a.tier]}` : 'border-border bg-surface-2',
        )}>
          <pre className={cn(
            'text-[7px] leading-[9px] font-mono select-none whitespace-pre',
            unlocked ? TIER_COLORS[a.tier] : 'text-muted-foreground/20',
          )}>
            {a.ascii}
          </pre>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-[10px] font-bold font-mono tracking-wider leading-tight',
            unlocked ? 'text-foreground' : 'text-muted-foreground/50',
          )}>
            {a.title}
          </p>
          <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">
            {a.description}
          </p>
          {unlocked && (
            <span className={cn('inline-block mt-1.5 text-[7px] font-mono tracking-wider px-1.5 py-px border',
              TIER_COLORS[a.tier], TIER_BORDER[a.tier], TIER_BG[a.tier]
            )}>
              COMPLETE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

async function fetchAchievements() {
  const res = await fetch('/api/achievements');
  if (!res.ok) throw new Error('Failed to load achievements');
  return res.json();
}

export function AchievementsView() {
  const { data, error, isLoading, refetch } = useFetch<{
    total: number;
    unlocked: number;
    unlockedKeys: string[];
  }>(fetchAchievements, []);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showOnly, setShowOnly] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [search, setSearch] = useState('');

  if (isLoading) return <PageLoader message="Scanning achievements..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  const unlockedSet = new Set(data?.unlockedKeys || []);
  const totalUnlocked = data?.unlocked || 0;
  const totalAchievements = ALL_ACHIEVEMENTS.length;
  const progress = (totalUnlocked / totalAchievements) * 100;

  // Filter achievements
  let filtered = ALL_ACHIEVEMENTS;
  if (activeCategory !== 'all') {
    filtered = filtered.filter(a => a.category === activeCategory);
  }
  if (showOnly === 'unlocked') {
    filtered = filtered.filter(a => unlockedSet.has(a.key));
  } else if (showOnly === 'locked') {
    filtered = filtered.filter(a => !unlockedSet.has(a.key));
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.key.toLowerCase().includes(q)
    );
  }

  // Sort: unlocked first, then by tier desc
  const sorted = [...filtered].sort((a, b) => {
    const aUnlocked = unlockedSet.has(a.key) ? 1 : 0;
    const bUnlocked = unlockedSet.has(b.key) ? 1 : 0;
    if (aUnlocked !== bUnlocked) return bUnlocked - aUnlocked;
    return b.tier - a.tier;
  });

  // Category counts
  const categoryCounts: Record<string, { total: number; unlocked: number }> = {};
  for (const a of ALL_ACHIEVEMENTS) {
    if (!categoryCounts[a.category]) categoryCounts[a.category] = { total: 0, unlocked: 0 };
    categoryCounts[a.category].total++;
    if (unlockedSet.has(a.key)) categoryCounts[a.category].unlocked++;
  }

  // Tier breakdown
  const tierCounts = [0, 0, 0, 0, 0, 0];
  const tierUnlocked = [0, 0, 0, 0, 0, 0];
  for (const a of ALL_ACHIEVEMENTS) {
    tierCounts[a.tier]++;
    if (unlockedSet.has(a.key)) tierUnlocked[a.tier]++;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="ticker mb-1">System Achievements</p>
            <h1 className="text-xl font-bold tracking-tight">
              {totalUnlocked}<span className="text-muted-foreground font-normal">/{totalAchievements}</span>
              <span className="text-muted-foreground font-normal text-sm ml-2">unlocked</span>
            </h1>
          </div>
          <div className="text-right">
            <p className="ticker mb-1">Completion</p>
            <p className={cn('numeral font-bold text-lg tabnum', progress === 100 && 'text-income')}>
              {progress.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: `${progress}%`, boxShadow: '0 0 8px hsl(var(--primary) / 0.4)' }}
            />
          </div>
        </div>

        {/* Tier breakdown */}
        <div className="flex gap-3 mt-3 flex-wrap">
          {[1, 2, 3, 4, 5].map(tier => (
            <div key={tier} className="flex items-center gap-1.5">
              <span className={cn('text-[9px] font-mono font-bold', TIER_COLORS[tier])}>
                {TIER_LABELS[tier]}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {tierUnlocked[tier]}/{tierCounts[tier]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="border border-border bg-surface-1 px-4 py-3 space-y-3">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              'px-2.5 py-1 text-[10px] font-mono border transition-colors',
              activeCategory === 'all'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface-2 text-muted-foreground hover:border-primary/40'
            )}
          >
            ALL ({totalAchievements})
          </button>
          {CATEGORIES.map(cat => {
            const c = categoryCounts[cat];
            if (!c) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-mono border transition-colors',
                  activeCategory === cat
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-2 text-muted-foreground hover:border-primary/40'
                )}
              >
                {CATEGORY_LABELS[cat]} ({c.unlocked}/{c.total})
              </button>
            );
          })}
        </div>

        {/* Status filter + search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(['all', 'unlocked', 'locked'] as const).map(s => (
              <button
                key={s}
                onClick={() => setShowOnly(s)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-mono border transition-colors',
                  showOnly === s
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-2 text-muted-foreground hover:border-primary/40'
                )}
              >
                {s === 'all' ? 'Show All' : s === 'unlocked' ? 'Unlocked' : 'Locked'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search achievements..."
            className="flex-1 min-w-[180px] h-7 px-2.5 text-[10px] font-mono border border-border bg-surface-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
          />
          <span className="text-[10px] font-mono text-muted-foreground">
            {sorted.length} shown
          </span>
        </div>
      </div>

      {/* Achievement Grid */}
      {sorted.length === 0 ? (
        <div className="border border-border bg-surface-1 px-5 py-12 text-center">
          <p className="ticker text-muted-foreground">No achievements match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {sorted.map(a => (
            <AchievementCard key={a.key} a={a} unlocked={unlockedSet.has(a.key)} />
          ))}
        </div>
      )}
    </div>
  );
}
