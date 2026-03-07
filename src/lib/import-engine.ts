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
    // If the CSV already has a meaningful category, keep it
    if (t.category && t.category !== 'Uncategorized') {
      return {
        ...t,
        originalDescription: t.description,
        autoMatched: true,
        flagged: false,
      };
    }
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
 * Uses hash-map grouping by |amount| for O(n) amortized performance.
 */
export function detectTransfers(transactions: ProcessedTransaction[]): ProcessedTransaction[] {
  const result = [...transactions];
  let pairCount = 0;
  const used = new Set<number>();

  // Group by |amount| rounded to cents
  const byAmount = new Map<string, number[]>();
  for (let i = 0; i < result.length; i++) {
    if (result[i].amount === 0) continue;
    const key = Math.abs(result[i].amount).toFixed(2);
    if (!byAmount.has(key)) byAmount.set(key, []);
    byAmount.get(key)!.push(i);
  }

  for (const indices of byAmount.values()) {
    if (indices.length < 2) continue;
    indices.sort((a, b) => result[a].date.localeCompare(result[b].date));

    for (let i = 0; i < indices.length; i++) {
      const ai = indices[i];
      if (used.has(ai)) continue;
      const a = result[ai];

      for (let j = i + 1; j < indices.length; j++) {
        const bi = indices[j];
        if (used.has(bi)) continue;
        const b = result[bi];

        const dayDiff = Math.abs((new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000);
        if (dayDiff > 2) break;

        if (Math.abs(a.amount + b.amount) < 0.01 && a.account !== b.account) {
          pairCount++;
          const pairId = `xfer-import-${pairCount}`;
          result[ai] = { ...result[ai], transferPairId: pairId, category: 'Transfer' };
          result[bi] = { ...result[bi], transferPairId: pairId, category: 'Transfer' };
          used.add(ai);
          used.add(bi);
          break;
        }
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

/**
 * Detect return/refund pairs using hash-map grouping by |amount| for O(n) amortized.
 */
export function detectReturns(transactions: ProcessedTransaction[]): ProcessedTransaction[] {
  const result = [...transactions];
  let pairCount = 0;
  const used = new Set<number>();

  // Build index of negative transactions by |amount|
  const negByAmount = new Map<string, number[]>();
  for (let i = 0; i < result.length; i++) {
    if (result[i].amount < 0 && !result[i].transferPairId) {
      const key = Math.abs(result[i].amount).toFixed(2);
      if (!negByAmount.has(key)) negByAmount.set(key, []);
      negByAmount.get(key)!.push(i);
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (used.has(i) || result[i].amount <= 0 || result[i].transferPairId) continue;
    const desc = result[i].description.toUpperCase();
    if (!RETURN_SIGNALS.some(kw => desc.includes(kw))) continue;

    const key = result[i].amount.toFixed(2);
    const candidates = negByAmount.get(key);
    if (!candidates) {
      result[i] = { ...result[i], category: 'Returns' };
      continue;
    }

    const merchantPrefix = desc.replace(/RETURN|REFUND|CREDIT|REVERSAL|REIMBURSE|REBATE|CHARGEBACK/gi, '').trim().slice(0, 12);
    let matched = false;

    for (const j of candidates) {
      if (used.has(j)) continue;
      const dayDiff = Math.abs((new Date(result[i].date).getTime() - new Date(result[j].date).getTime()) / 86400000);
      if (dayDiff > 30) continue;
      if (result[j].description.toUpperCase().includes(merchantPrefix.slice(0, 8))) {
        pairCount++;
        const pairId = `return-import-${pairCount}`;
        result[i] = { ...result[i], returnPairId: pairId, category: 'Returns' };
        result[j] = { ...result[j], returnPairId: pairId };
        used.add(i);
        used.add(j);
        matched = true;
        break;
      }
    }

    if (!matched) {
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
