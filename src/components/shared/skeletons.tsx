import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════
   BASE SKELETON — dark shimmer
══════════════════════════════════════════ */
function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        'bg-surface-2 relative overflow-hidden rounded-sm',
        'after:absolute after:inset-0 after:translate-x-[-100%]',
        'after:bg-gradient-to-r after:from-transparent after:via-foreground/5 after:to-transparent',
        'after:animate-[shimmer_1.8s_ease-in-out_infinite]',
        className
      )}
      style={style}
    />
  );
}

/* Shimmer keyframe via inline style */
const shimmerStyle = `
  @keyframes shimmer {
    100% { transform: translateX(100%); }
  }
`;

export function SkeletonStyles() {
  return <style>{shimmerStyle}</style>;
}

/* ══════════════════════════════════════════
   STAT CARD SKELETON
══════════════════════════════════════════ */
export function StatCardSkeleton() {
  return (
    <div className="relative border border-border bg-surface-1 p-4 overflow-hidden">
      {/* Top accent bar */}
      <Skeleton className="absolute top-0 left-0 right-0 h-px" />
      {/* Corner marks */}
      <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-[3px]">
        <Skeleton className="h-px w-4" /><Skeleton className="h-px w-2.5" /><Skeleton className="h-px w-1.5" />
      </div>
      <div className="pt-7 pb-4 px-0 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   CHART SKELETON
══════════════════════════════════════════ */
export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-14" />
      </div>
      <div className="flex items-end gap-2 px-2" style={{ height }}>
        {[55, 80, 45, 90, 65, 75].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   COMMAND HEADER SKELETON
══════════════════════════════════════════ */
export function CommandHeaderSkeleton() {
  return (
    <div className="border border-border bg-surface-1 p-5">
      <Skeleton className="h-2 w-16 mb-3" />
      <Skeleton className="h-12 w-56 mb-3" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ACTIVITY FEED SKELETON
══════════════════════════════════════════ */
export function ActivityFeedSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="space-y-0 divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <Skeleton className="w-7 h-7 shrink-0 rounded-sm" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   GOAL RING SKELETON
══════════════════════════════════════════ */
export function GoalRingsSkeleton() {
  return (
    <div className="border border-border bg-surface-1 p-4">
      <Skeleton className="h-2.5 w-24 mb-4" />
      <div className="flex flex-wrap gap-4 justify-center pt-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex flex-col items-center gap-2 w-[72px]">
            <Skeleton className="w-[72px] h-[72px] rounded-full" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-2 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TABLE ROW SKELETON
══════════════════════════════════════════ */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className={cn('h-3', i === 2 ? 'w-40' : i === 0 ? 'w-6' : 'w-20')} />
        </td>
      ))}
    </tr>
  );
}

/* ══════════════════════════════════════════
   DASHBOARD SKELETON
══════════════════════════════════════════ */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <CommandHeaderSkeleton />
      {/* Metric strip */}
      <div className="grid grid-cols-4 border border-border bg-surface-1">
        {[0,1,2,3].map(i => (
          <div key={i} className={cn('px-4 py-3', i > 0 && 'border-l border-border')}>
            <Skeleton className="h-2 w-20 mb-2" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <StatCardSkeleton key={i} />)}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
      </div>
      {/* Activity + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
        <ActivityFeedSkeleton rows={6} />
        <GoalRingsSkeleton />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   LIST SKELETON
══════════════════════════════════════════ */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="border border-border bg-surface-1 p-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-2.5 w-52" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-border bg-surface-1 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-1 w-full" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  );
}

export function TransactionTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border border-border bg-surface-1 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <Skeleton className="h-2.5 w-36" />
      </div>
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { Skeleton };
