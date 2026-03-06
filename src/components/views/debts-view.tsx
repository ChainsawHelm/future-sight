'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFetch, useMutation } from '@/hooks/use-fetch';
import { debtsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type { Debt } from '@/types/models';

// ─── Amortization helpers ─────────────────────────────────────────────────────

interface PayoffResult {
  months: number;
  interestPaid: number;
}

function calcPayoff(balance: number, annualRate: number, monthlyPayment: number): PayoffResult {
  if (monthlyPayment <= 0 || balance <= 0) return { months: Infinity, interestPaid: Infinity };
  const r = annualRate / 100 / 12;
  if (r === 0) {
    const months = Math.ceil(balance / monthlyPayment);
    return { months, interestPaid: 0 };
  }
  let bal = balance;
  let interest = 0;
  let months = 0;
  while (bal > 0.01 && months < 600) {
    const i = bal * r;
    interest += i;
    bal = bal + i - monthlyPayment;
    months++;
  }
  return { months, interestPaid: interest };
}

function calcCascadeSchedule(
  sortedDebts: Debt[],
  extras: Record<string, number>
): { id: string; payoffMonth: number; totalInterest: number }[] {
  const n = sortedDebts.length;
  const balances = sortedDebts.map(d => d.balance);
  const payments = sortedDebts.map(d => d.minimumPayment + (extras[d.id] || 0));
  const interestAccum = new Array(n).fill(0);
  const payoffMonths = new Array(n).fill(Infinity);
  const paidOff = new Array(n).fill(false);

  for (let month = 0; month < 600; month++) {
    const cascadeTarget = paidOff.findIndex(p => !p);
    if (cascadeTarget === -1) break;

    const cascadePool = paidOff.reduce((sum: number, paid: boolean, i: number) => paid ? sum + payments[i] : sum, 0);

    for (let i = 0; i < n; i++) {
      if (paidOff[i]) continue;
      const r = sortedDebts[i].interestRate / 100 / 12;
      const interest = balances[i] * r;
      interestAccum[i] += interest;
      const pay = payments[i] + (i === cascadeTarget ? cascadePool : 0);
      balances[i] = Math.max(0, balances[i] + interest - pay);
      if (balances[i] < 0.01) {
        paidOff[i] = true;
        payoffMonths[i] = month + 1;
      }
    }
  }

  return sortedDebts.map((d, i) => ({
    id: d.id,
    payoffMonth: payoffMonths[i],
    totalInterest: interestAccum[i],
  }));
}

function monthsToDate(months: number): string {
  if (!isFinite(months)) return 'Never';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  mortgage:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  auto:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  student:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  credit_card: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  personal:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  other:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

const TYPE_LABELS: Record<string, string> = {
  mortgage: 'Mortgage', auto: 'Auto', student: 'Student',
  credit_card: 'Credit Card', personal: 'Personal', other: 'Other',
};

// ─── Drag handle ──────────────────────────────────────────────────────────────

function DragHandle({ listeners, attributes }: { listeners: any; attributes: any }) {
  return (
    <button
      {...listeners}
      {...attributes}
      className="flex flex-col items-center justify-center w-6 h-10 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary/60 transition-colors touch-none"
      title="Drag to reorder"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <circle cx="3" cy="2" r="1.2" />
        <circle cx="9" cy="2" r="1.2" />
        <circle cx="3" cy="6" r="1.2" />
        <circle cx="9" cy="6" r="1.2" />
        <circle cx="3" cy="10" r="1.2" />
        <circle cx="9" cy="10" r="1.2" />
      </svg>
    </button>
  );
}

// ─── Sortable debt card ───────────────────────────────────────────────────────

interface DebtCardProps {
  d: Debt;
  idx: number;
  strategy: 'avalanche' | 'snowball' | 'manual';
  extra: number;
  totalPayment: number;
  sliderMax: number;
  solo: PayoffResult;
  minOnly: PayoffResult;
  cascade: { payoffMonth: number; totalInterest: number } | null;
  cascadeEnabled: boolean;
  canReceiveCascade: boolean;
  isLastInList: boolean;
  sortedDebts: Debt[];
  getExtra: (d: Debt) => number;
  onExtraChange: (id: string, value: number) => void;
  onSaveExtra: (id: string) => void;
  onDelete: (id: string) => void;
  onCascadeRedirect: (fromIndex: number, toId: string) => void;
}

function SortableDebtCard(props: DebtCardProps) {
  const { d, strategy } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: d.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DebtCardInner
        {...props}
        isDragging={isDragging}
        dragHandle={strategy === 'manual' ? <DragHandle listeners={listeners} attributes={attributes} /> : null}
      />
    </div>
  );
}

function DebtCardInner({
  d, idx, strategy, extra, totalPayment, sliderMax,
  solo, minOnly, cascade, cascadeEnabled,
  canReceiveCascade, isLastInList, sortedDebts, getExtra,
  onExtraChange, onSaveExtra, onDelete, onCascadeRedirect,
  isDragging, dragHandle,
}: DebtCardProps & { isDragging: boolean; dragHandle: React.ReactNode }) {
  const progress = d.originalBalance > 0 ? 1 - d.balance / d.originalBalance : 0;
  const displayMonths = cascade ? cascade.payoffMonth : solo.months;
  const displayInterest = cascade ? cascade.totalInterest : solo.interestPaid;
  const interestSaved = minOnly.interestPaid - displayInterest;

  return (
    <div className={cn(
      'border border-border bg-surface-1 relative overflow-hidden transition-shadow',
      isDragging && 'shadow-[0_0_20px_hsl(var(--primary)/0.3)] border-primary/40'
    )}>
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ backgroundColor: idx === 0 ? 'hsl(var(--expense))' : idx === 1 ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />

      <div className="p-4">
        {/* Debt header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            {dragHandle}
            {strategy !== 'manual' && (
              <span className="w-5 h-5 flex items-center justify-center bg-surface-3 text-muted-foreground font-mono text-[10px] font-bold shrink-0">
                {idx + 1}
              </span>
            )}
            <div className="w-6 h-6 flex items-center justify-center bg-surface-3 text-muted-foreground shrink-0">
              {TYPE_ICONS[d.type]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">{d.name}</h3>
                <span className="ticker">{TYPE_LABELS[d.type]}</span>
              </div>
              <p className="ticker text-[10px]">
                <span className="text-expense font-semibold">{d.interestRate}% APR</span>
                {' · '}min {formatCurrency(d.minimumPayment)}/mo
                {' · '}due day {d.dueDay}
              </p>
            </div>
          </div>
          <button onClick={() => onDelete(d.id)} className="text-muted-foreground/30 hover:text-expense transition-colors mt-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>

        {/* Balance + progress */}
        <div className="mb-3">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="numeral text-lg font-bold tabnum text-expense">{formatCurrency(d.balance)}</span>
            <span className="ticker text-primary text-xs">{(progress * 100).toFixed(1)}% paid off</span>
          </div>
          <div className="h-1.5 bg-surface-3 overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress * 100}%`, boxShadow: '0 0 6px hsl(var(--primary) / 0.4)' }} />
          </div>
        </div>

        {/* Extra payment slider */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="ticker text-[10px]">Extra Monthly Payment</label>
            <div className="flex items-center gap-2">
              <span className="numeral text-xs font-bold tabnum text-income">+{formatCurrency(extra)}/mo</span>
              <span className="ticker text-[10px]">→ total {formatCurrency(totalPayment)}/mo</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={Math.round(sliderMax)}
            step={10}
            value={extra}
            onChange={e => onExtraChange(d.id, Number(e.target.value))}
            onMouseUp={() => onSaveExtra(d.id)}
            onTouchEnd={() => onSaveExtra(d.id)}
            className="w-full h-1.5 appearance-none bg-surface-3 cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>$0</span>
            <span>{formatCurrency(sliderMax)}</span>
          </div>
        </div>

        {/* Payoff comparison */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-xs">
          <div>
            <p className="ticker mb-1">Payoff Date</p>
            <p className="numeral font-bold text-sm">{monthsToDate(displayMonths)}</p>
            <p className="ticker text-[10px]">{isFinite(displayMonths) ? `${displayMonths} months` : 'never'}{cascadeEnabled ? ' w/ cascade' : ''}</p>
          </div>
          <div>
            <p className="ticker mb-1">Interest {cascadeEnabled ? '(cascade)' : '(w/ extra)'}</p>
            <p className="numeral font-bold text-sm text-expense">{isFinite(displayInterest) ? formatCurrency(displayInterest) : '∞'}</p>
            {extra > 0 && !cascadeEnabled && (
              <p className="ticker text-[10px]">min only: {formatCurrency(minOnly.interestPaid)}</p>
            )}
          </div>
          <div>
            <p className="ticker mb-1">Interest Saved</p>
            <p className={cn('numeral font-bold text-sm', interestSaved > 0 ? 'text-income' : 'text-muted-foreground')}>
              {interestSaved > 0 ? formatCurrency(interestSaved) : '—'}
            </p>
            {extra === 0 && !cascadeEnabled && (
              <p className="ticker text-[10px]">add extra to save</p>
            )}
          </div>
        </div>

        {/* Cascade redirect button */}
        {canReceiveCascade && (
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => onCascadeRedirect(idx - 1, d.id)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono border border-income/40 text-income hover:bg-income/10 transition-colors"
            >
              <span>▶▶</span>
              Redirect {formatCurrency(sortedDebts[idx - 1].minimumPayment + getExtra(sortedDebts[idx - 1]))}/mo freed from {sortedDebts[idx - 1].name} → this debt
            </button>
          </div>
        )}
      </div>

      {/* Cascade arrow between cards */}
      {cascadeEnabled && !isLastInList && (
        <div className="flex items-center justify-center py-1 border-t border-income/20 bg-income/5">
          <span className="ticker text-income text-[10px]">▼ freed payment cascades to next debt</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DebtsView() {
  const { data, error, isLoading, refetch } = useFetch<{ debts: Debt[] }>(() => debtsApi.list(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball' | 'manual'>('avalanche');
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [cascadeEnabled, setCascadeEnabled] = useState(false);
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [form, setForm] = useState({
    name: '', balance: '', originalBalance: '', interestRate: '', minimumPayment: '',
    type: 'other' as Debt['type'], dueDay: '1',
  });

  const createMutation = useMutation(useCallback((d: any) => debtsApi.create(d), []));
  const deleteMutation = useMutation(useCallback((id: string) => debtsApi.delete(id), []));
  const updateMutation = useMutation(useCallback(({ id, data }: { id: string; data: any }) => debtsApi.update(id, data), []));
  const reorderMutation = useMutation(useCallback((ids: string[]) => debtsApi.reorder(ids), []));

  const debts = data?.debts || [];

  // Sort by strategy
  const sortedDebts = (() => {
    if (strategy === 'manual') {
      if (manualOrder) {
        const map = new Map(debts.map(d => [d.id, d]));
        return manualOrder.map(id => map.get(id)).filter(Boolean) as Debt[];
      }
      // Use sortOrder from API (default DB order)
      return [...debts].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    if (strategy === 'avalanche') return [...debts].sort((a, b) => b.interestRate - a.interestRate);
    return [...debts].sort((a, b) => a.balance - b.balance); // snowball
  })();

  const totalBalance  = debts.reduce((s, d) => s + d.balance, 0);
  const totalOriginal = debts.reduce((s, d) => s + d.originalBalance, 0);
  const overallProgress = totalOriginal > 0 ? (1 - totalBalance / totalOriginal) : 0;

  const getExtra = (d: Debt) => extras[d.id] !== undefined ? extras[d.id] : d.extraPayment;

  // Cascade schedule
  const cascadeResults = cascadeEnabled
    ? calcCascadeSchedule(sortedDebts, Object.fromEntries(sortedDebts.map(d => [d.id, getExtra(d)])))
    : null;

  const soloResults = Object.fromEntries(sortedDebts.map(d => {
    const r = calcPayoff(d.balance, d.interestRate, d.minimumPayment + getExtra(d));
    return [d.id, r];
  }));

  const minOnlyResults = Object.fromEntries(sortedDebts.map(d => {
    const r = calcPayoff(d.balance, d.interestRate, d.minimumPayment);
    return [d.id, r];
  }));

  const totalMonthlyPayment = debts.reduce((s, d) => s + d.minimumPayment + getExtra(d), 0);
  const totalInterestMin = Object.values(minOnlyResults).reduce((s, r) => s + (isFinite(r.interestPaid) ? r.interestPaid : 0), 0);
  const totalInterestWithExtras = cascadeEnabled && cascadeResults
    ? cascadeResults.reduce((s, r) => s + r.totalInterest, 0)
    : Object.values(soloResults).reduce((s, r) => s + (isFinite(r.interestPaid) ? r.interestPaid : 0), 0);

  const cascadeMap = cascadeResults
    ? Object.fromEntries(cascadeResults.map(r => [r.id, r]))
    : null;

  // ─── DnD sensors ─────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedDebts.findIndex(d => d.id === active.id);
    const newIndex = sortedDebts.findIndex(d => d.id === over.id);
    const newOrder = arrayMove(sortedDebts, oldIndex, newIndex);
    const newIds = newOrder.map(d => d.id);

    setManualOrder(newIds);
    reorderMutation.mutate(newIds);
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutate({
      name: form.name,
      balance: parseFloat(form.balance),
      originalBalance: parseFloat(form.originalBalance || form.balance),
      interestRate: parseFloat(form.interestRate),
      minimumPayment: parseFloat(form.minimumPayment),
      extraPayment: 0,
      type: form.type,
      dueDay: parseInt(form.dueDay),
    });
    setForm({ name: '', balance: '', originalBalance: '', interestRate: '', minimumPayment: '', type: 'other', dueDay: '1' });
    setShowAdd(false);
    setManualOrder(null);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this debt?')) return;
    await deleteMutation.mutate(id);
    setManualOrder(null);
    refetch();
  };

  const handleExtraChange = (id: string, value: number) => {
    setExtras(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveExtra = async (id: string) => {
    const extra = extras[id];
    if (extra === undefined) return;
    await updateMutation.mutate({ id, data: { extraPayment: extra } });
  };

  const handleCascadeRedirect = (fromIndex: number, toId: string) => {
    const fromDebt = sortedDebts[fromIndex];
    const freed = fromDebt.minimumPayment + getExtra(fromDebt);
    setExtras(prev => ({ ...prev, [toId]: (prev[toId] ?? sortedDebts.find(d => d.id === toId)?.extraPayment ?? 0) + freed }));
  };

  if (isLoading) return <PageLoader message="Loading debts..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;

  // ─── Render ──────────────────────────────────────────────────────────────────

  const debtCards = sortedDebts.map((d, idx) => {
    const extra = getExtra(d);
    const totalPayment = d.minimumPayment + extra;
    const sliderMax = Math.max(Math.min(d.balance / 3, 2000), d.minimumPayment * 4);
    const solo = soloResults[d.id];
    const minOnly = minOnlyResults[d.id];
    const cascade = cascadeMap?.[d.id] ?? null;
    const canReceiveCascade = cascadeEnabled && idx > 0;

    return (
      <SortableDebtCard
        key={d.id}
        d={d}
        idx={idx}
        strategy={strategy}
        extra={extra}
        totalPayment={totalPayment}
        sliderMax={sliderMax}
        solo={solo}
        minOnly={minOnly}
        cascade={cascade}
        cascadeEnabled={cascadeEnabled}
        canReceiveCascade={canReceiveCascade}
        isLastInList={idx === sortedDebts.length - 1}
        sortedDebts={sortedDebts}
        getExtra={getExtra}
        onExtraChange={handleExtraChange}
        onSaveExtra={handleSaveExtra}
        onDelete={handleDelete}
        onCascadeRedirect={handleCascadeRedirect}
      />
    );
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="ticker mb-1">Debt Tracker</p>
            <h1 className="text-xl font-bold tracking-tight">
              {formatCurrency(totalBalance)} <span className="text-muted-foreground font-normal">remaining</span>
            </h1>
            {totalOriginal > 0 && (
              <p className="ticker mt-0.5">of {formatCurrency(totalOriginal)} original</p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className={cn(
              'h-9 px-4 text-sm font-semibold transition-colors',
              showAdd
                ? 'border border-border bg-surface-2 text-muted-foreground hover:text-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
            )}
          >
            {showAdd ? '✕ Cancel' : '+ Add Debt'}
          </button>
        </div>
      </div>

      {/* Overall stats strip */}
      {debts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-border bg-surface-1 divide-x divide-border">
          {[
            { label: 'Paid Off', value: `${(overallProgress * 100).toFixed(1)}%`, sub: 'of original balance' },
            { label: 'Monthly Total', value: formatCurrency(totalMonthlyPayment), sub: 'all debts combined' },
            { label: 'Interest (min only)', value: formatCurrency(totalInterestMin), sub: 'remaining' },
            { label: 'Interest (with extras)', value: formatCurrency(totalInterestWithExtras), sub: cascadeEnabled ? 'with cascade' : 'no cascade', ok: totalInterestWithExtras < totalInterestMin },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3">
              <p className="ticker mb-1">{s.label}</p>
              <p className={cn('numeral font-bold text-base tabnum', s.ok === true && 'text-income')}>{s.value}</p>
              <p className="ticker text-[10px]">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Strategy + cascade controls */}
      {debts.length > 1 && (
        <div className="border border-border bg-surface-1 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="ticker shrink-0">Payoff Strategy</p>
          <div className="flex gap-1">
            {(['avalanche', 'snowball', 'manual'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setStrategy(s); setManualOrder(null); }}
                className={cn(
                  'px-3 py-1 text-xs font-mono border transition-colors',
                  strategy === s
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-2 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {s === 'avalanche' ? 'Avalanche (high rate first)' : s === 'snowball' ? 'Snowball (low balance first)' : 'Manual order'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setCascadeEnabled(c => !c)}
              className={cn(
                'flex items-center gap-2 px-3 py-1 text-xs font-mono border transition-colors',
                cascadeEnabled
                  ? 'border-income bg-income/10 text-income'
                  : 'border-border bg-surface-2 text-muted-foreground hover:border-income/40'
              )}
            >
              <span className="text-[10px]">{cascadeEnabled ? '▶' : '▷'}</span>
              Cascade payments {cascadeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {cascadeEnabled && debts.length > 1 && (
        <div className="border border-income/30 bg-income/5 px-4 py-2.5 text-xs font-mono text-income">
          Cascade ON: when each debt is paid off, its freed monthly payment automatically rolls into the next debt, accelerating payoff.
        </div>
      )}

      {strategy === 'manual' && debts.length > 1 && (
        <div className="border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs font-mono text-primary flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" className="shrink-0 opacity-60">
            <circle cx="3" cy="2" r="1.2" />
            <circle cx="9" cy="2" r="1.2" />
            <circle cx="3" cy="6" r="1.2" />
            <circle cx="9" cy="6" r="1.2" />
            <circle cx="3" cy="10" r="1.2" />
            <circle cx="9" cy="10" r="1.2" />
          </svg>
          Drag the grip handle to reorder debts. Your custom order is saved automatically.
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="border border-border bg-surface-1 p-5 space-y-4 animate-fade-in">
          <p className="ticker text-primary mb-2">New Debt</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5"><label className="ticker">Name</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Student Loan" /></div>
            <div className="space-y-1.5"><label className="ticker">Current Balance ($)</label><Input type="number" step="0.01" min="0" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} required /></div>
            <div className="space-y-1.5"><label className="ticker">Original Balance ($)</label><Input type="number" step="0.01" min="0" value={form.originalBalance} onChange={e => setForm(f => ({ ...f, originalBalance: e.target.value }))} placeholder="Leave blank = same as current" /></div>
            <div className="space-y-1.5"><label className="ticker">Interest Rate (%)</label><Input type="number" step="0.01" min="0" max="100" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} required /></div>
            <div className="space-y-1.5"><label className="ticker">Minimum Payment ($)</label><Input type="number" step="0.01" min="0" value={form.minimumPayment} onChange={e => setForm(f => ({ ...f, minimumPayment: e.target.value }))} required /></div>
            <div className="space-y-1.5">
              <label className="ticker">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="flex h-9 w-full border border-border bg-surface-1 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary transition-colors">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={createMutation.isLoading}
            className="h-9 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/85 transition-colors disabled:opacity-40">
            {createMutation.isLoading ? 'Adding...' : 'Add Debt'}
          </button>
        </form>
      )}

      {debts.length === 0 ? (
        <EmptyState
          icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
          title="No debts tracked"
          description="Add your debts to see payoff schedules and snowball/avalanche projections."
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedDebts.map(d => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {debtCards}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
