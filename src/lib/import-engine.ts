/**
 * Import Processing Engine
 * Handles: merchant rule matching, transfer pair detection, duplicate flagging.
 * Runs client-side during import preview.
 */

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
}

/**
 * Extract the "merchant" from a transaction description.
 * Normalizes: uppercase, strip numbers/dates/special chars, take first meaningful words.
 */
export function extractMerchant(description: string): string {
  return description
    .toUpperCase()
    // Remove dates (MM/DD, MM-DD-YY, etc.)
    .replace(/\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?/g, '')
    // Remove transaction IDs / reference numbers
    .replace(/#\w+/g, '')
    .replace(/\b(REF|TXN|AUTH|ID|POS|ACH|EFT|DEBIT|CREDIT|PURCHASE|PAYMENT|WITHDRAWAL)\b/g, '')
    // Remove trailing numbers
    .replace(/\d+$/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Take first 3 meaningful words (usually the merchant name)
    .split(' ')
    .filter(w => w.length > 1)
    .slice(0, 3)
    .join(' ');
}

/**
 * Apply merchant rules to categorize transactions.
 * Rules map: { "MERCHANT_KEY": "Category Name" }
 */
export function applyMerchantRules(
  transactions: RawTransaction[],
  rules: Record<string, string>
): ProcessedTransaction[] {
  if (!rules || Object.keys(rules).length === 0) {
    return transactions.map(t => ({
      ...t,
      originalDescription: t.description,
      autoMatched: false,
      flagged: false,
    }));
  }

  // Build a lookup: lowercase merchant fragments
  const ruleEntries = Object.entries(rules).map(([merchant, category]) => ({
    merchant: merchant.toUpperCase(),
    category,
  }));

  return transactions.map(t => {
    const merchant = extractMerchant(t.description);
    let matched = false;
    let category = t.category;

    // Try exact match first, then substring
    for (const rule of ruleEntries) {
      if (merchant.includes(rule.merchant) || rule.merchant.includes(merchant)) {
        category = rule.category;
        matched = true;
        break;
      }
    }

    return {
      ...t,
      category,
      originalDescription: t.description,
      autoMatched: matched,
      flagged: false,
    };
  });
}

/**
 * Detect transfer pairs: matching amounts with opposite signs on the same or adjacent dates.
 * Marks both sides with a shared transferPairId.
 */
export function detectTransfers(transactions: ProcessedTransaction[]): ProcessedTransaction[] {
  const result = [...transactions];
  let pairCount = 0;

  // Sort by date for adjacency matching
  const indexed = result.map((t, i) => ({ t, i })).sort((a, b) => a.t.date.localeCompare(b.t.date));

  const used = new Set<number>();

  for (let i = 0; i < indexed.length; i++) {
    if (used.has(indexed[i].i)) continue;
    const a = indexed[i].t;

    // Look for a matching opposite-sign transaction within 2 days
    for (let j = i + 1; j < indexed.length; j++) {
      if (used.has(indexed[j].i)) continue;
      const b = indexed[j].t;

      // Must be within 2 days
      const dayDiff = Math.abs(
        (new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000
      );
      if (dayDiff > 2) break; // sorted, so no point continuing

      // Must be opposite signs and same absolute amount
      if (
        Math.abs(a.amount + b.amount) < 0.01 &&
        a.amount !== 0 &&
        a.account !== b.account // different accounts
      ) {
        pairCount++;
        const pairId = `xfer-import-${pairCount}`;
        result[indexed[i].i] = { ...result[indexed[i].i], transferPairId: pairId, category: 'Transfers' };
        result[indexed[j].i] = { ...result[indexed[j].i], transferPairId: pairId, category: 'Transfers' };
        used.add(indexed[i].i);
        used.add(indexed[j].i);
        break;
      }
    }
  }

  return result;
}

/**
 * Detect potential duplicates against existing transactions.
 * Flags rows that match date + amount + description (fuzzy).
 */
export function flagDuplicates(
  incoming: ProcessedTransaction[],
  existing: { date: string; amount: number; description: string }[]
): ProcessedTransaction[] {
  if (existing.length === 0) return incoming;

  // Build a quick lookup: "date|amount" -> descriptions
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
        m === descUp ||
        m.includes(descUp.slice(0, 15)) ||
        descUp.includes(m.slice(0, 15))
      );
      if (isDupe) {
        return { ...t, flagged: true };
      }
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
  stats: {
    total: number;
    autoMatched: number;
    transfers: number;
    duplicates: number;
  };
} {
  // Step 1: Apply merchant rules
  let processed = applyMerchantRules(raw, merchantRules);

  // Step 2: Detect transfers
  processed = detectTransfers(processed);

  // Step 3: Flag duplicates
  processed = flagDuplicates(processed, existingTransactions);

  const autoMatched = processed.filter(t => t.autoMatched).length;
  const transfers = processed.filter(t => t.transferPairId).length;
  const duplicates = processed.filter(t => t.flagged).length;

  return {
    transactions: processed,
    stats: { total: processed.length, autoMatched, transfers, duplicates },
  };
}
