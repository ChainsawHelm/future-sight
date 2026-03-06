/**
 * Import Processing Engine
 * Handles: merchant rule matching, keyword auto-categorization,
 * transfer pair detection, and duplicate flagging.
 * Runs client-side during import preview.
 */

import { categorizeTransaction } from './categorize';

export interface RawTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

export interface ProcessedTransaction extends RawTransaction {
  originalDescription: string;
  autoMatched: boolean;
  flagged: boolean;
  transferPairId?: string;
  returnPairId?: string;
}

/**
 * Extract the "merchant" from a transaction description.
 */
export function extractMerchant(description: string): string {
  return description
    .toUpperCase()
    .replace(/\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?/g, '')
    .replace(/#\w+/g, '')
    .replace(/\b(REF|TXN|AUTH|ID|POS|ACH|EFT|DEBIT|CREDIT|PURCHASE|PAYMENT|WITHDRAWAL)\b/g, '')
    .replace(/\d+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1)
    .slice(0, 3)
    .join(' ');
}

/**
 * Apply merchant rules + keyword engine to categorize transactions.
 * Priority: merchant rules (DB) → sign routing → 300+ keyword map → default.
 */
export function applyMerchantRules(
  transactions: RawTransaction[],
  rules: Record<string, string>
): ProcessedTransaction[] {
  return transactions.map(t => {
    const { category, autoMatched } = categorizeTransaction(t.description, t.amount, rules);
    return {
      ...t,
      category,
      originalDescription: t.description,
      autoMatched,
      flagged: false,
    };
  });
}

/**
 * Detect transfer pairs: matching amounts with opposite signs on adjacent dates.
 */
export function detectTransfers(transactions: ProcessedTransaction[]): ProcessedTransaction[] {
  const result = [...transactions];
  let pairCount = 0;
  const indexed = result.map((t, i) => ({ t, i })).sort((a, b) => a.t.date.localeCompare(b.t.date));
  const used = new Set<number>();

  for (let i = 0; i < indexed.length; i++) {
    if (used.has(indexed[i].i)) continue;
    const a = indexed[i].t;
    for (let j = i + 1; j < indexed.length; j++) {
      if (used.has(indexed[j].i)) continue;
      const b = indexed[j].t;
      const dayDiff = Math.abs((new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000);
      if (dayDiff > 2) break;
      if (Math.abs(a.amount + b.amount) < 0.01 && a.amount !== 0 && a.account !== b.account) {
        pairCount++;
        const pairId = `xfer-import-${pairCount}`;
        result[indexed[i].i] = { ...result[indexed[i].i], transferPairId: pairId, category: 'Transfer' };
        result[indexed[j].i] = { ...result[indexed[j].i], transferPairId: pairId, category: 'Transfer' };
        used.add(indexed[i].i);
        used.add(indexed[j].i);
        break;
      }
    }
  }
  return result;
}

/**
 * Detect return/refund pairs: a positive credit that matches a prior negative charge
 * from the same merchant within 30 days.
 */
const RETURN_SIGNALS = ['RETURN', 'REFUND', 'CREDIT', 'REVERSAL', 'REIMBURSE', 'REBATE', 'CHARGEBACK'];

export function detectReturns(transactions: ProcessedTransaction[]): ProcessedTransaction[] {
  const result = [...transactions];
  let pairCount = 0;
  const used = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    if (used.has(i)) continue;
    const t = result[i];
    // Only look at positive amounts with return-like descriptions
    if (t.amount <= 0 || t.transferPairId) continue;
    const desc = t.description.toUpperCase();
    const hasSignal = RETURN_SIGNALS.some(kw => desc.includes(kw));
    if (!hasSignal) continue;

    // Try to find the original charge: same merchant prefix, opposite sign, within 30 days
    const merchantPrefix = desc.replace(/RETURN|REFUND|CREDIT|REVERSAL|REIMBURSE|REBATE|CHARGEBACK/gi, '').trim().slice(0, 12);
    for (let j = 0; j < result.length; j++) {
      if (i === j || used.has(j)) continue;
      const candidate = result[j];
      if (candidate.amount >= 0 || candidate.transferPairId) continue;
      const dayDiff = Math.abs((new Date(t.date).getTime() - new Date(candidate.date).getTime()) / 86400000);
      if (dayDiff > 30) continue;
      if (Math.abs(t.amount + candidate.amount) < 0.01 && candidate.description.toUpperCase().includes(merchantPrefix.slice(0, 8))) {
        pairCount++;
        const pairId = `return-import-${pairCount}`;
        result[i] = { ...result[i], returnPairId: pairId, category: 'Returns' };
        result[j] = { ...result[j], returnPairId: pairId };
        used.add(i);
        used.add(j);
        break;
      }
    }

    // Even without a pair match, still classify as return if description has signal
    if (!used.has(i)) {
      result[i] = { ...result[i], category: 'Returns' };
    }
  }
  return result;
}

/**
 * Detect potential duplicates against existing transactions.
 */
export function flagDuplicates(
  incoming: ProcessedTransaction[],
  existing: { date: string; amount: number; description: string }[]
): ProcessedTransaction[] {
  if (existing.length === 0) return incoming;
  const existingMap = new Map<string, string[]>();
  for (const e of existing) {
    const key = `${e.date}|${e.amount.toFixed(2)}`;
    if (!existingMap.has(key)) existingMap.set(key, []);
    existingMap.get(key)!.push(e.description.toUpperCase());
  }
  return incoming.map(t => {
    const key = `${t.date}|${t.amount.toFixed(2)}`;
    const matches = existingMap.get(key);
    if (matches) {
      const descUp = t.description.toUpperCase();
      const isDupe = matches.some(m =>
        m === descUp || m.includes(descUp.slice(0, 15)) || descUp.includes(m.slice(0, 15))
      );
      if (isDupe) return { ...t, flagged: true };
    }
    return t;
  });
}

/**
 * Full import processing pipeline.
 */
export function processImport(
  raw: RawTransaction[],
  merchantRules: Record<string, string>,
  existingTransactions: { date: string; amount: number; description: string }[]
): {
  transactions: ProcessedTransaction[];
  stats: { total: number; autoMatched: number; transfers: number; returns: number; duplicates: number };
} {
  let processed = applyMerchantRules(raw, merchantRules);
  processed = detectTransfers(processed);
  processed = detectReturns(processed);
  processed = flagDuplicates(processed, existingTransactions);
  const autoMatched = processed.filter(t => t.autoMatched).length;
  const transfers = processed.filter(t => t.transferPairId).length;
  const returns = processed.filter(t => t.returnPairId || t.category === 'Returns').length;
  const duplicates = processed.filter(t => t.flagged).length;
  return { transactions: processed, stats: { total: processed.length, autoMatched, transfers, returns, duplicates } };
}
