// ─── Debt Payoff Calculator ──────────────────────────────────────────────────
// Pure client-side utility for snowball/avalanche debt payoff projections,
// amortization schedules, and balance-over-time timeline data.

import type { Debt } from '@/types/models';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface DebtPayoffResult {
  debtId: string;
  debtName: string;
  months: number;
  totalInterest: number;
  totalPaid: number;
  amortization: AmortizationRow[];
}

export interface StrategyResult {
  strategy: 'snowball' | 'avalanche';
  label: string;
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  debts: DebtPayoffResult[];
}

export interface TimelinePoint {
  month: number;
  label: string; // "Mar 2026"
  [debtName: string]: number | string; // balance per debt + "total"
}

// ─── Core amortization for a single debt ─────────────────────────────────────

export function calcAmortization(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  maxMonths = 600
): AmortizationRow[] {
  if (balance <= 0 || monthlyPayment <= 0) return [];
  const r = annualRate / 100 / 12;
  const rows: AmortizationRow[] = [];
  let bal = balance;

  for (let m = 1; m <= maxMonths && bal > 0.01; m++) {
    const interest = bal * r;
    const actualPayment = Math.min(monthlyPayment, bal + interest);
    const principal = actualPayment - interest;
    bal = Math.max(0, bal - principal);
    rows.push({
      month: m,
      payment: Math.round(actualPayment * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(bal * 100) / 100,
    });
  }
  return rows;
}

// ─── Strategy simulation (snowball or avalanche) ─────────────────────────────

export function simulateStrategy(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche',
  extraBudget: number = 0,
  maxMonths: number = 600
): StrategyResult {
  if (debts.length === 0) {
    return {
      strategy,
      label: strategy === 'snowball' ? 'Snowball (smallest balance first)' : 'Avalanche (highest rate first)',
      totalMonths: 0,
      totalInterest: 0,
      totalPaid: 0,
      debts: [],
    };
  }

  // Sort debts by strategy
  const sorted = [...debts].sort((a, b) => {
    if (strategy === 'snowball') return a.balance - b.balance;
    return b.interestRate - a.interestRate;
  });

  const n = sorted.length;
  const balances = sorted.map(d => d.balance);
  const rates = sorted.map(d => d.interestRate / 100 / 12);
  const minPayments = sorted.map(d => d.minimumPayment);
  const interestAccum = new Array(n).fill(0);
  const paidAccum = new Array(n).fill(0);
  const payoffMonths = new Array(n).fill(0);
  const paidOff = new Array(n).fill(false);
  const amortizations: AmortizationRow[][] = sorted.map(() => []);

  // Extra payments per debt from saved settings
  const debtExtras = sorted.map(d => d.extraPayment);

  for (let month = 1; month <= maxMonths; month++) {
    // Find the current target (first unpaid debt in sorted order)
    const target = paidOff.findIndex(p => !p);
    if (target === -1) break;

    // Calculate freed-up payments from paid-off debts
    let freedPayments = 0;
    for (let i = 0; i < n; i++) {
      if (paidOff[i]) {
        freedPayments += minPayments[i] + debtExtras[i];
      }
    }

    for (let i = 0; i < n; i++) {
      if (paidOff[i]) continue;

      const interest = balances[i] * rates[i];
      interestAccum[i] += interest;

      // Target debt gets all extra + freed payments
      let payment = minPayments[i] + debtExtras[i];
      if (i === target) {
        payment += freedPayments + (extraBudget > 0 ? extraBudget : 0);
        // Subtract extraBudget from totalExtra pool only once (it's a fixed monthly amount)
      }

      const actualPayment = Math.min(payment, balances[i] + interest);
      const principal = actualPayment - interest;
      balances[i] = Math.max(0, balances[i] - principal);
      paidAccum[i] += actualPayment;

      amortizations[i].push({
        month,
        payment: Math.round(actualPayment * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        balance: Math.round(balances[i] * 100) / 100,
      });

      if (balances[i] < 0.01) {
        paidOff[i] = true;
        payoffMonths[i] = month;
      }
    }
  }

  const debtResults: DebtPayoffResult[] = sorted.map((d, i) => ({
    debtId: d.id,
    debtName: d.name,
    months: payoffMonths[i] || (paidOff[i] ? payoffMonths[i] : Infinity),
    totalInterest: Math.round(interestAccum[i] * 100) / 100,
    totalPaid: Math.round(paidAccum[i] * 100) / 100,
    amortization: amortizations[i],
  }));

  const maxMonth = Math.max(...payoffMonths.filter((m: number) => m > 0), 0);

  return {
    strategy,
    label: strategy === 'snowball' ? 'Snowball (smallest balance first)' : 'Avalanche (highest rate first)',
    totalMonths: maxMonth,
    totalInterest: Math.round(debtResults.reduce((s, d) => s + d.totalInterest, 0) * 100) / 100,
    totalPaid: Math.round(debtResults.reduce((s, d) => s + d.totalPaid, 0) * 100) / 100,
    debts: debtResults,
  };
}

// ─── Timeline data for Recharts ──────────────────────────────────────────────

export function buildTimeline(result: StrategyResult): TimelinePoint[] {
  if (result.debts.length === 0) return [];

  const maxMonth = Math.max(...result.debts.map(d => d.months));
  if (!isFinite(maxMonth) || maxMonth <= 0) return [];

  const points: TimelinePoint[] = [];
  const now = new Date();

  // Sample every month up to 60, then every 3 months after that, cap at 360
  const cap = Math.min(maxMonth, 360);
  for (let m = 0; m <= cap; m++) {
    if (m > 60 && m % 3 !== 0 && m !== cap) continue;

    const date = new Date(now);
    date.setMonth(date.getMonth() + m);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    const point: TimelinePoint = { month: m, label };
    let total = 0;

    for (const debt of result.debts) {
      let balance: number;
      if (m === 0) {
        // Initial balance
        balance = debt.amortization.length > 0
          ? debt.amortization[0].balance + debt.amortization[0].principal
          : 0;
      } else if (m <= debt.amortization.length) {
        balance = debt.amortization[m - 1].balance;
      } else {
        balance = 0;
      }
      point[debt.debtName] = Math.round(balance);
      total += Math.round(balance);
    }
    point['total'] = total;
    points.push(point);
  }

  return points;
}

// ─── Comparison helper ───────────────────────────────────────────────────────

export interface StrategyComparison {
  snowball: StrategyResult;
  avalanche: StrategyResult;
  winner: 'snowball' | 'avalanche' | 'tie';
  interestSaved: number; // positive = winner saves this much
  monthsSaved: number;   // positive = winner finishes this many months sooner
}

export function compareStrategies(debts: Debt[]): StrategyComparison {
  const snowball = simulateStrategy(debts, 'snowball');
  const avalanche = simulateStrategy(debts, 'avalanche');

  const diff = snowball.totalInterest - avalanche.totalInterest;
  const monthDiff = snowball.totalMonths - avalanche.totalMonths;

  let winner: 'snowball' | 'avalanche' | 'tie' = 'tie';
  if (diff > 1) winner = 'avalanche';
  else if (diff < -1) winner = 'snowball';

  return {
    snowball,
    avalanche,
    winner,
    interestSaved: Math.abs(diff),
    monthsSaved: Math.abs(monthDiff),
  };
}
