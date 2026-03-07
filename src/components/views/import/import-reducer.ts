import { extractMerchant, type ProcessedTransaction } from '@/lib/import-engine';

// ─── Types ──────────────────────────────────────

export interface MerchantGroup {
  merchant: string;
  category: string;
  count: number;
  totalAmount: number;
  autoMatched: boolean;
  indices: number[];
  sampleDescription: string;
  dateRange: [string, string];
  avgAmount: number;
}

export interface FileGroup {
  filename: string;
  startIdx: number;
  count: number;
}

export interface FileQueueItem {
  name: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
  count?: number;
  error?: string;
}

export interface ImportStats {
  total: number;
  autoMatched: number;
  transfers: number;
  duplicates: number;
  returns: number;
}

export type ImportPhase = 'upload' | 'processing' | 'summary' | 'categorize' | 'confirm' | 'complete';

export interface ImportState {
  phase: ImportPhase;
  transactions: ProcessedTransaction[];
  merchantMap: Map<string, MerchantGroup>;
  uncategorizedQueue: string[];
  currentQueueIndex: number;
  fileGroups: FileGroup[];
  fileQueue: FileQueueItem[];
  stats: ImportStats;
  excludeDupes: boolean;
  sessionRules: Map<string, string>;
  importResult: { count: number; files: { name: string; count: number }[] } | null;
  error: string | null;
}

export type ImportAction =
  | { type: 'START_PARSING'; files: FileQueueItem[] }
  | { type: 'FILE_STATUS'; filename: string; status: FileQueueItem['status']; count?: number; error?: string }
  | { type: 'PROCESSING_COMPLETE'; transactions: ProcessedTransaction[]; stats: ImportStats; fileGroups: FileGroup[] }
  | { type: 'ADVANCE_PHASE'; phase: ImportPhase }
  | { type: 'CATEGORIZE_MERCHANT'; merchant: string; category: string }
  | { type: 'SKIP_MERCHANT' }
  | { type: 'TOGGLE_DUPES' }
  | { type: 'IMPORT_SUCCESS'; result: ImportState['importResult'] }
  | { type: 'IMPORT_ERROR'; error: string | null }
  | { type: 'RESET' };

// ─── Initial State ──────────────────────────────

export const initialState: ImportState = {
  phase: 'upload',
  transactions: [],
  merchantMap: new Map(),
  uncategorizedQueue: [],
  currentQueueIndex: 0,
  fileGroups: [],
  fileQueue: [],
  stats: { total: 0, autoMatched: 0, transfers: 0, duplicates: 0, returns: 0 },
  excludeDupes: true,
  sessionRules: new Map(),
  importResult: null,
  error: null,
};

// ─── Helpers ────────────────────────────────────

export function buildMerchantMap(transactions: ProcessedTransaction[]): Map<string, MerchantGroup> {
  const map = new Map<string, MerchantGroup>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const merchant = extractMerchant(t.description) || t.description.slice(0, 30);
    const existing = map.get(merchant);

    if (existing) {
      existing.count++;
      existing.totalAmount += t.amount;
      existing.indices.push(i);
      if (t.date < existing.dateRange[0]) existing.dateRange[0] = t.date;
      if (t.date > existing.dateRange[1]) existing.dateRange[1] = t.date;
      existing.avgAmount = existing.totalAmount / existing.count;
      // If any transaction in group is uncategorized, the group is uncategorized
      if (t.category === 'Uncategorized') {
        existing.category = 'Uncategorized';
        existing.autoMatched = false;
      }
    } else {
      map.set(merchant, {
        merchant,
        category: t.category,
        count: 1,
        totalAmount: t.amount,
        autoMatched: t.autoMatched,
        indices: [i],
        sampleDescription: t.originalDescription || t.description,
        dateRange: [t.date, t.date],
        avgAmount: t.amount,
      });
    }
  }
  return map;
}

export function getUncategorizedQueue(merchantMap: Map<string, MerchantGroup>): string[] {
  const queue: { merchant: string; count: number }[] = [];
  for (const [key, group] of merchantMap) {
    if (group.category === 'Uncategorized') {
      queue.push({ merchant: key, count: group.count });
    }
  }
  // Sort by count descending so high-frequency merchants come first
  queue.sort((a, b) => b.count - a.count);
  return queue.map(q => q.merchant);
}

export function deriveFinalTransactions(
  transactions: ProcessedTransaction[],
  merchantMap: Map<string, MerchantGroup>,
  excludeDupes: boolean
): ProcessedTransaction[] {
  // Build index→category lookup from merchant map
  const indexToCategory = new Map<number, string>();
  for (const group of merchantMap.values()) {
    for (const idx of group.indices) {
      indexToCategory.set(idx, group.category);
    }
  }
  return transactions
    .map((t, i) => ({ ...t, category: indexToCategory.get(i) ?? t.category }))
    .filter(t => !excludeDupes || !t.flagged);
}

// ─── Reducer ────────────────────────────────────

export function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'START_PARSING':
      return { ...state, phase: 'processing', fileQueue: action.files, error: null };

    case 'FILE_STATUS':
      return {
        ...state,
        fileQueue: state.fileQueue.map(f =>
          f.name === action.filename
            ? { ...f, status: action.status, count: action.count, error: action.error }
            : f
        ),
      };

    case 'PROCESSING_COMPLETE': {
      const merchantMap = buildMerchantMap(action.transactions);
      const uncategorizedQueue = getUncategorizedQueue(merchantMap);
      return {
        ...state,
        phase: 'summary',
        transactions: action.transactions,
        merchantMap,
        uncategorizedQueue,
        currentQueueIndex: 0,
        stats: action.stats,
        fileGroups: action.fileGroups,
      };
    }

    case 'ADVANCE_PHASE':
      return { ...state, phase: action.phase };

    case 'CATEGORIZE_MERCHANT': {
      const { merchant, category } = action;
      const newMap = new Map(state.merchantMap);
      const group = newMap.get(merchant);
      if (!group) return state;

      newMap.set(merchant, { ...group, category, autoMatched: false });

      const newRules = new Map(state.sessionRules);
      newRules.set(merchant, category);

      // Progressive learning: apply to remaining uncategorized merchants
      const newQueue = [...state.uncategorizedQueue];
      const toRemove = new Set<number>();
      const merchantUpper = merchant.toUpperCase();

      for (let qi = state.currentQueueIndex + 1; qi < newQueue.length; qi++) {
        const otherKey = newQueue[qi];
        const otherGroup = newMap.get(otherKey);
        if (!otherGroup || otherGroup.category !== 'Uncategorized') continue;

        // Check if other merchant name contains this merchant as a substring
        if (otherKey.toUpperCase().includes(merchantUpper) || merchantUpper.includes(otherKey.toUpperCase())) {
          newMap.set(otherKey, { ...otherGroup, category, autoMatched: true });
          newRules.set(otherKey, category);
          toRemove.add(qi);
        }
      }

      const filteredQueue = newQueue.filter((_, i) => !toRemove.has(i));
      const nextIndex = state.currentQueueIndex + 1;
      const autoAdvance = nextIndex >= filteredQueue.length;

      return {
        ...state,
        merchantMap: newMap,
        sessionRules: newRules,
        uncategorizedQueue: filteredQueue,
        currentQueueIndex: nextIndex,
        phase: autoAdvance ? 'confirm' : state.phase,
      };
    }

    case 'SKIP_MERCHANT': {
      const nextIndex = state.currentQueueIndex + 1;
      return {
        ...state,
        currentQueueIndex: nextIndex,
        phase: nextIndex >= state.uncategorizedQueue.length ? 'confirm' : state.phase,
      };
    }

    case 'TOGGLE_DUPES':
      return { ...state, excludeDupes: !state.excludeDupes };

    case 'IMPORT_SUCCESS':
      return { ...state, phase: 'complete', importResult: action.result };

    case 'IMPORT_ERROR':
      return { ...state, error: action.error };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}
