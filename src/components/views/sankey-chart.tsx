'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { isRealIncome, isRealExpense } from '@/lib/classify';

/* ══════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════ */
interface TxnForSankey {
  amount: number;
  category: string;
  account: string;
  description: string;
  transferPairId?: string | null;
}

interface Node {
  id: string;
  label: string;
  value: number;
  color: string;
  column: number;
  y: number;       // computed pixel y (top of node)
  h: number;       // computed pixel height
}

interface Link {
  sourceId: string;
  targetId: string;
  value: number;
  color: string;
  srcY: number;    // computed: y-center of link band at source
  tgtY: number;    // computed: y-center of link band at target
  thickness: number;
}

/* ══════════════════════════════════════════════════════════════════
   COLOR HELPERS
══════════════════════════════════════════════════════════════════ */
const INCOME_COLOR   = '#059669'; // emerald
const ACCOUNT_COLORS = ['#7C3AED', '#8B5CF6', '#A78BFA', '#6D28D9', '#5B21B6', '#4C1D95'];
const CAT_COLORS: Record<string, string> = {
  Groceries: '#10B981', Dining: '#F59E0B', Shopping: '#3B82F6',
  Transportation: '#6366F1', Housing: '#EC4899', Utilities: '#14B8A6',
  Healthcare: '#EF4444', Entertainment: '#8B5CF6', Subscriptions: '#06B6D4',
  Gas: '#F97316', Travel: '#0EA5E9', Education: '#84CC16',
  Fitness: '#22C55E', 'Personal Care': '#F43F5E', Business: '#64748B',
  Charity: '#EC4899', Savings: '#10B981', Phone: '#3B82F6',
  'ATM & Fees': '#94A3B8', Uncategorized: '#CBD5E1',
};
const MERCHANT_COLOR = '#94A3B8';

function catColor(cat: string): string {
  return CAT_COLORS[cat] || '#8B5CF6';
}

/* ══════════════════════════════════════════════════════════════════
   LAYOUT COMPUTATION
══════════════════════════════════════════════════════════════════ */
const GAP = 6;
const NODE_W = 14;
const MIN_NODE_H = 18;
const LABEL_PAD = 8;

function simplifyMerchant(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?/g, '')
    .replace(/\b(PURCHASE|PAYMENT|DEBIT|POS|ACH|REF\w*|TXN\w*|#\w+)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ') || desc.slice(0, 20).toUpperCase();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function buildSankeyData(
  txns: TxnForSankey[],
  svgH: number,
  svgW: number,
  isMobile: boolean
): { nodes: Node[]; links: Link[] } {
  // ── Aggregate data ───────────────────────────────────────────────
  const incomeBySource: Record<string, number> = {};
  const incomeBySourceAccount: Record<string, Record<string, number>> = {};
  const expenseByAccount: Record<string, Record<string, number>> = {};
  const expenseByCategory: Record<string, number> = {};
  const expenseByCategoryMerchant: Record<string, Record<string, number>> = {};

  for (const t of txns) {
    if (isRealIncome(t)) {
      const src = t.category === 'Income' ? simplifyMerchant(t.description) : t.category;
      incomeBySource[src] = (incomeBySource[src] || 0) + t.amount;
      if (!incomeBySourceAccount[src]) incomeBySourceAccount[src] = {};
      incomeBySourceAccount[src][t.account] = (incomeBySourceAccount[src][t.account] || 0) + t.amount;
    }
    if (isRealExpense(t)) {
      const amt = Math.abs(t.amount);
      if (!expenseByAccount[t.account]) expenseByAccount[t.account] = {};
      expenseByAccount[t.account][t.category] = (expenseByAccount[t.account][t.category] || 0) + amt;

      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + amt;

      const merchant = simplifyMerchant(t.description);
      if (!expenseByCategoryMerchant[t.category]) expenseByCategoryMerchant[t.category] = {};
      expenseByCategoryMerchant[t.category][merchant] =
        (expenseByCategoryMerchant[t.category][merchant] || 0) + amt;
    }
  }

  // ── Build node lists ─────────────────────────────────────────────
  const MAX_INCOME    = 5;
  const MAX_ACCOUNTS  = 6;
  const MAX_CATS      = isMobile ? 5 : 8;
  const MAX_MERCHANTS = isMobile ? 5 : 8;

  const incomeSources = Object.entries(incomeBySource)
    .sort(([, a], [, b]) => b - a).slice(0, MAX_INCOME);
  const accounts = Object.entries(
    Object.keys(expenseByAccount).reduce((acc, acct) => {
      const total = Object.values(expenseByAccount[acct]).reduce((s, v) => s + v, 0);
      acc[acct] = total;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, MAX_ACCOUNTS);
  const categories = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a).slice(0, MAX_CATS);
  const merchants = Object.entries(
    Object.values(expenseByCategoryMerchant).reduce((acc, merchantMap) => {
      for (const [m, v] of Object.entries(merchantMap)) {
        acc[m] = (acc[m] || 0) + v;
      }
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, MAX_MERCHANTS);

  // Column x positions (as fractions of svgW)
  const colFracs = isMobile
    ? [0.05, 0.5]           // income → categories (2-col simplified)
    : [0.04, 0.33, 0.62, 0.85];

  // ── Assign nodes ─────────────────────────────────────────────────
  const rawNodes: Omit<Node, 'y' | 'h'>[] = [
    ...incomeSources.map(([label, value], i) => ({
      id: `inc:${label}`, label, value, color: INCOME_COLOR, column: 0,
    })),
    ...(isMobile ? [] : accounts.map(([label, value], i) => ({
      id: `acct:${label}`, label, value, color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length], column: 1,
    }))),
    ...categories.map(([label, value]) => ({
      id: `cat:${label}`, label, value, color: catColor(label), column: isMobile ? 1 : 2,
    })),
    ...(isMobile ? [] : merchants.map(([label, value]) => ({
      id: `mer:${label}`, label, value, color: MERCHANT_COLOR, column: 3,
    }))),
  ];

  // ── Layout: stack nodes per column ─────────────────────────────
  const numCols = isMobile ? 2 : 4;
  const totalH = svgH - 40; // vertical padding

  const nodes: Node[] = [];
  for (let col = 0; col < numCols; col++) {
    const colNodes = rawNodes.filter(n => n.column === col);
    if (colNodes.length === 0) continue;
    const totalVal = colNodes.reduce((s, n) => s + n.value, 0);
    const totalGaps = GAP * (colNodes.length - 1);
    const availH = Math.max(0, totalH - totalGaps);

    // Scale so all nodes fit
    let y = 20;
    for (const n of colNodes) {
      const rawH = totalVal > 0 ? (n.value / totalVal) * availH : availH / colNodes.length;
      const h = Math.max(MIN_NODE_H, rawH);
      const xFrac = colFracs[col];
      nodes.push({ ...n, y, h });
      y += h + GAP;
    }
  }

  // ── Build links ──────────────────────────────────────────────────
  // Track how much of each node's height has been consumed by outgoing/incoming links
  const srcConsumed: Record<string, number> = {};
  const tgtConsumed: Record<string, number> = {};

  const rawLinks: { sourceId: string; targetId: string; value: number; color: string }[] = [];

  if (isMobile) {
    // Direct income → category links
    for (const [src, srcVal] of incomeSources) {
      const srcId = `inc:${src}`;
      const srcNode = nodes.find(n => n.id === srcId);
      if (!srcNode) continue;
      // Distribute proportionally to categories
      const totalCatVal = categories.reduce((s, [, v]) => s + v, 0);
      for (const [cat] of categories) {
        const catId = `cat:${cat}`;
        if (!nodes.find(n => n.id === catId)) continue;
        const linkVal = totalCatVal > 0
          ? (expenseByCategory[cat] / totalCatVal) * srcVal
          : srcVal / categories.length;
        rawLinks.push({ sourceId: srcId, targetId: catId, value: linkVal, color: INCOME_COLOR });
      }
    }
  } else {
    // Income → Account links
    for (const [src, _] of incomeSources) {
      const srcId = `inc:${src}`;
      for (const [acct] of accounts) {
        const tgtId = `acct:${acct}`;
        const v = incomeBySourceAccount[src]?.[acct] || 0;
        if (v > 0) {
          rawLinks.push({ sourceId: srcId, targetId: tgtId, value: v, color: INCOME_COLOR });
        }
      }
    }
    // Account → Category links
    for (const [acct, i] of accounts.map((a, i) => [a[0], i] as [string, number])) {
      const srcId = `acct:${acct}`;
      const srcNode = nodes.find(n => n.id === srcId);
      if (!srcNode) continue;
      for (const [cat] of categories) {
        const tgtId = `cat:${cat}`;
        const v = expenseByAccount[acct]?.[cat] || 0;
        if (v > 0) {
          rawLinks.push({ sourceId: srcId, targetId: tgtId, value: v, color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] });
        }
      }
    }
    // Category → Merchant links
    for (const [cat] of categories) {
      const srcId = `cat:${cat}`;
      for (const [mer] of merchants) {
        const tgtId = `mer:${mer}`;
        const v = expenseByCategoryMerchant[cat]?.[mer] || 0;
        if (v > 0) {
          rawLinks.push({ sourceId: srcId, targetId: tgtId, value: v, color: catColor(cat) });
        }
      }
    }
  }

  // ── Position links within nodes ────────────────────────────────
  const links: Link[] = [];
  for (const rl of rawLinks) {
    const srcNode = nodes.find(n => n.id === rl.sourceId);
    const tgtNode = nodes.find(n => n.id === rl.targetId);
    if (!srcNode || !tgtNode) continue;

    // Compute total value flowing through source/target for scaling
    const srcTotal = rawLinks.filter(l => l.sourceId === rl.sourceId).reduce((s, l) => s + l.value, 0);
    const tgtTotal = rawLinks.filter(l => l.targetId === rl.targetId).reduce((s, l) => s + l.value, 0);

    const srcUsed = srcConsumed[rl.sourceId] || 0;
    const tgtUsed = tgtConsumed[rl.targetId] || 0;

    const srcBand = srcTotal > 0 ? (rl.value / srcTotal) * srcNode.h : 0;
    const tgtBand = tgtTotal > 0 ? (rl.value / tgtTotal) * tgtNode.h : 0;
    const thickness = Math.max(1.5, Math.min(srcBand, tgtBand) * 0.8);

    const srcY = srcNode.y + srcUsed + srcBand / 2;
    const tgtY = tgtNode.y + tgtUsed + tgtBand / 2;

    srcConsumed[rl.sourceId] = srcUsed + srcBand;
    tgtConsumed[rl.targetId] = tgtUsed + tgtBand;

    links.push({ ...rl, srcY, tgtY, thickness });
  }

  return { nodes, links };
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
interface SankeyChartProps {
  transactions: TxnForSankey[];
  period: string;
}

const COL_LABELS_4 = ['Income', 'Accounts', 'Categories', 'Merchants'];
const COL_LABELS_2 = ['Income', 'Spending'];

export function SankeyChart({ transactions, period }: SankeyChartProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isMobile = width < 520;
  const svgH = isMobile ? 300 : 380;
  const colFracs = isMobile
    ? [0.05, 0.75]
    : [0.04, 0.34, 0.63, 0.86];
  const colLabels = isMobile ? COL_LABELS_2 : COL_LABELS_4;

  const { nodes, links } = useMemo(
    () => buildSankeyData(transactions, svgH, width, isMobile),
    [transactions, svgH, width, isMobile]
  );

  const handleNodeClick = (node: Node) => {
    if (node.id.startsWith('inc:')) {
      const src = node.id.slice(4);
      router.push(`/transactions?search=${encodeURIComponent(src)}`);
    } else if (node.id.startsWith('acct:')) {
      router.push(`/transactions?account=${encodeURIComponent(node.label)}`);
    } else if (node.id.startsWith('cat:')) {
      router.push(`/transactions?category=${encodeURIComponent(node.label)}`);
    } else if (node.id.startsWith('mer:')) {
      router.push(`/transactions?search=${encodeURIComponent(node.label)}`);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No transaction data for this period
      </div>
    );
  }

  const hasIncome = nodes.some(n => n.column === 0);
  if (!hasIncome) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No income/expense data in this period
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative">
        {/* Column labels as a flex row above SVG */}
        <div className="flex text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {colFracs.map((frac, i) => (
            <div
              key={i}
              className="text-center"
              style={{
                width: `${((colFracs[i + 1] || 1.0) - frac) * 100}%`,
              }}
            >
              {colLabels[i]}
            </div>
          ))}
        </div>

        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${width} ${svgH}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          <defs>
            {links.map((link, i) => (
              <linearGradient
                key={i}
                id={`lg-${i}`}
                x1="0%" y1="0%" x2="100%" y2="0%"
              >
                <stop offset="0%" stopColor={link.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={link.color} stopOpacity={0.2} />
              </linearGradient>
            ))}
          </defs>

          {/* ── Links ──────────────────────────────────────────── */}
          {links.map((link, i) => {
            const srcNode = nodes.find(n => n.id === link.sourceId)!;
            const tgtNode = nodes.find(n => n.id === link.targetId)!;
            if (!srcNode || !tgtNode) return null;
            const x1 = colFracs[srcNode.column] * width + NODE_W;
            const x2 = colFracs[tgtNode.column] * width;
            const cpX = (x1 + x2) / 2;
            const isHovered = hoveredNode === link.sourceId || hoveredNode === link.targetId;
            return (
              <path
                key={i}
                d={`M${x1},${link.srcY} C${cpX},${link.srcY} ${cpX},${link.tgtY} ${x2},${link.tgtY}`}
                fill="none"
                stroke={`url(#lg-${i})`}
                strokeWidth={Math.max(1.5, link.thickness)}
                strokeOpacity={isHovered ? 0.8 : 0.4}
                className="transition-all duration-200"
              />
            );
          })}

          {/* ── Nodes ──────────────────────────────────────────── */}
          {nodes.map(node => {
            const x = colFracs[node.column] * width;
            const isHovered = hoveredNode === node.id;
            const labelRight = node.column >= (isMobile ? 1 : 2);
            const maxLabelW = isMobile ? 80 : 110;
            const labelLen = isMobile ? 10 : 14;
            const label = truncate(node.label, labelLen);

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* Node rectangle */}
                <rect
                  x={x}
                  y={node.y}
                  width={NODE_W}
                  height={node.h}
                  rx={3}
                  fill={node.color}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-all duration-150"
                />
                {/* Hover ring */}
                {isHovered && (
                  <rect
                    x={x - 1}
                    y={node.y - 1}
                    width={NODE_W + 2}
                    height={node.h + 2}
                    rx={4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                )}
                {/* Label */}
                <text
                  x={labelRight ? x - LABEL_PAD : x + NODE_W + LABEL_PAD}
                  y={node.y + node.h / 2}
                  textAnchor={labelRight ? 'end' : 'start'}
                  dominantBaseline="middle"
                  fontSize={isMobile ? 8 : 10}
                  fontFamily="var(--font-sans), system-ui"
                  fontWeight={isHovered ? '600' : '500'}
                  fill={isHovered ? node.color : 'currentColor'}
                  className="select-none transition-all duration-150"
                  style={{ fill: isHovered ? node.color : 'hsl(var(--foreground) / 0.75)' }}
                >
                  {label}
                </text>
                {/* Value label (only on hover or large nodes) */}
                {(isHovered || node.h > 28) && (
                  <text
                    x={labelRight ? x - LABEL_PAD : x + NODE_W + LABEL_PAD}
                    y={node.y + node.h / 2 + (isMobile ? 10 : 13)}
                    textAnchor={labelRight ? 'end' : 'start'}
                    dominantBaseline="middle"
                    fontSize={isMobile ? 7 : 8.5}
                    fontFamily="var(--font-mono), monospace"
                    style={{ fill: 'hsl(var(--muted-foreground))' }}
                    className="select-none"
                  >
                    {formatCurrency(node.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Click hint */}
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Click any node to view matching transactions
        </p>
      </div>
    </div>
  );
}
