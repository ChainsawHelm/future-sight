/**
 * Transaction classification helpers.
 *
 * These are the source of truth for whether a transaction counts as real
 * income, a real expense, a transfer, a return, or a debt payment. Every
 * financial calculation in the app should filter through these functions
 * so that numbers are consistent everywhere.
 */

export interface ClassifiableTxn {
  amount: number;
  category: string;
  transferPairId?: string | null;
  returnPairId?: string | null;
  description?: string;
}

// Keywords that indicate a return/refund (positive credit that isn't income)
const RETURN_KEYWORDS = [
  'RETURN', 'REFUND', 'CREDIT', 'REVERSAL', 'CASHBACK', 'REIMBURSEMENT',
  'REBATE', 'CHARGEBACK', 'ADJUSTMENT', 'CREDIT MEMO', 'REIMBURSE',
  'REFND', 'CRED', 'CASH BACK',
];

/** Transfer between the user's own accounts — exclude from both income and expenses. */
export function isTransfer(t: ClassifiableTxn): boolean {
  return t.category === 'Transfer' || !!t.transferPairId;
}

/** Credit card / loan payment — money leaving an account to pay down debt.
 *  Should not count as a spending expense. */
export function isDebtPayment(t: ClassifiableTxn): boolean {
  return t.category === 'Debt Payment';
}

/** Return/refund — positive credit that reverses a prior purchase.
 *  Should not count as income. */
export function isReturn(t: ClassifiableTxn): boolean {
  if (t.category === 'Returns') return true;
  if (t.returnPairId) return true;
  // Heuristic: positive amount + description matches return keywords
  if (t.amount > 0 && t.description) {
    const desc = t.description.toUpperCase();
    return RETURN_KEYWORDS.some(kw => desc.includes(kw));
  }
  return false;
}

/** Real income — money actually received (paycheck, freelance, interest).
 *  Excludes transfers, returns, and debt payment credits. */
export function isRealIncome(t: ClassifiableTxn): boolean {
  return t.amount > 0 && !isTransfer(t) && !isReturn(t) && !isDebtPayment(t);
}

/** Real expense — actual spending.
 *  Excludes transfers and debt payments. */
export function isRealExpense(t: ClassifiableTxn): boolean {
  return t.amount < 0 && !isTransfer(t) && !isDebtPayment(t);
}

// ─── Utility filters ────────────────────────────

/** Filter to only real income and expense transactions (exclude noise). */
export function excludeNoise(txns: ClassifiableTxn[]): ClassifiableTxn[] {
  return txns.filter(t => isRealIncome(t) || isRealExpense(t));
}

/** Filter out all transfers. */
export function excludeTransfers(txns: ClassifiableTxn[]): ClassifiableTxn[] {
  return txns.filter(t => !isTransfer(t));
}

/** Filter out returns/refunds. */
export function excludeReturns(txns: ClassifiableTxn[]): ClassifiableTxn[] {
  return txns.filter(t => !isReturn(t));
}
