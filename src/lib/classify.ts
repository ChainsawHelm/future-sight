/**
 * Transaction classification helpers.
 *
 * These are the source of truth for whether a transaction counts as real
 * income, a real expense, a transfer, or a debt payment. Every financial
 * calculation in the app should filter through these functions so that
 * numbers are consistent everywhere.
 */

export interface ClassifiableTxn {
  amount: number;
  category: string;
  transferPairId?: string | null;
}

/** Transfer between the user's own accounts — exclude from both income and expenses. */
export function isTransfer(t: ClassifiableTxn): boolean {
  return t.category === 'Transfer' || !!t.transferPairId;
}

/** Credit card / loan payment — money leaving an account to pay down debt.
 *  Should not count as a spending expense. */
export function isDebtPayment(t: ClassifiableTxn): boolean {
  return t.category === 'Debt Payment';
}

/** Real income — money actually received (paycheck, freelance, interest).
 *  Excludes transfers and returns. */
export function isRealIncome(t: ClassifiableTxn): boolean {
  return t.amount > 0 && !isTransfer(t);
}

/** Real expense — actual spending.
 *  Excludes transfers and debt payments. */
export function isRealExpense(t: ClassifiableTxn): boolean {
  return t.amount < 0 && !isTransfer(t) && !isDebtPayment(t);
}
