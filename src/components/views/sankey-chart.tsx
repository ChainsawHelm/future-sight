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
  y: number;   // top pixel of node bar
  h: number;   // pixel height of node bar
}

interface Link {
  sourceId: string;
  targetId: string;
  value: number;
  srcColor: string;
  tgtColor: string;
  srcY0: number;   // top of ribbon band at source
  srcY1: number;   // bottom of ribbon band at source
  tgtY0: number;   // top of ribbon band at target
  tgtY1: number;   // bottom of ribbon band at target
}

/* ══════════════════════════════════════════════════════════════════
   COLOR PALETTE — GLASSHOUSE harmonious
══════════════════════════════════════════════════════════════════ */
const INCOME_COLOR   = '#4E8B62';
const ACCOUNT_COLORS = ['#3D7A8A', '#4A90A4', '#2E7D9A', '#4A7E6E', '#5A8A7A', '#326E84'];
const CAT_COLORS: Record<string, string> = {
  Groceries:       '#4A8C5C',
  Dining:          '#C4883A',
  Shopping:        '#4A7AB0',
  Transportation:  '#5A72B0',
  Housing:         '#A04A72',
  Utilities:       '#3A9A9A',
  Healthcare:      '#B04A4A',
  Entertainment:   '#7A5AB0',
  Subscriptions:   '#3A9AB0',
  Gas:             '#C47A3A',
  Travel:          '#3A85B0',
  Education:       '#7A9A3A',
  Fitness:         '#4A9A5A',
  'Personal Care': '#A04A6A',
  Business:        '#5A7A8A',
  Charity:         '#A04A8A',
  Savings:         '#3A9A6A',
  Phone:           '#4A6AB0',
  Insurance:       '#7A6A5A',
  Restaurants:     '#C47A5A',
  'ATM & Fees':    '#8A9AA8',
  Uncategorized:   '#9AA0A8',
};
const MERCHANT_COLOR = '#7B8FA6';

function catColor(cat: string): string {
  return CAT_COLORS[cat] || '#6A7A9A';
}

/* ══════════════════════════════════════════════════════════════════
   LAYOUT CONSTANTS
══════════════════════════════════════════════════════════════════ */
const GAP         = 8;
const NODE_W      = 12;
const MIN_NODE_H  = 24;
const LABEL_PAD   = 11;
const TOP_PAD     = 30;

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
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function buildSankeyData(
  txns: TxnForSankey[],
  svgH: number,
  svgW: number,
  isMobile: boolean
): { nodes: Node[]; links: Link[] } {
  // ── Aggregate ────────────────────────────────────────────────────
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

  // ── Node lists ────────────────────────────────────────────────────
  const incomeSources = Object.entries(incomeBySource).sort(([, a], [, b]) => b - a).slice(0, 5);
  const accounts = Object.entries(
    Object.keys(expenseByAccount).reduce((acc, acct) => {
      acc[acct] = Object.values(expenseByAccount[acct]).reduce((s, v) => s + v, 0);
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, 6);
  const categories = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a).slice(0, isMobile ? 5 : 8);
  const merchants = Object.entries(
    Object.values(expenseByCategoryMerchant).reduce((acc, m) => {
      for (const [k, v] of Object.entries(m)) acc[k] = (acc[k] || 0) + v;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, isMobile ? 5 : 8);

  const colFracs = isMobile ? [0.03, 0.72] : [0.03, 0.31, 0.60, 0.84];

  // ── Assign raw nodes ─────────────────────────────────────────────
  const rawNodes: Omit<Node, 'y' | 'h'>[] = [
    ...incomeSources.map(([label, value]) => ({
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

  // ── Layout: stack nodes per column ───────────────────────────────
  const numCols = isMobile ? 2 : 4;
  const availH = svgH - TOP_PAD - 16;
  const nodes: Node[] = [];

  for (let col = 0; col < numCols; col++) {
    const colNodes = rawNodes.filter(n => n.column === col);
    if (!colNodes.length) continue;
    const totalVal = colNodes.reduce((s, n) => s + n.value, 0);
    const totalGaps = GAP * (colNodes.length - 1);
    const drawH = Math.max(0, availH - totalGaps);
    let y = TOP_PAD;
    for (const n of colNodes) {
      const rawH = totalVal > 0 ? (n.value / totalVal) * drawH : drawH / colNodes.length;
      const h = Math.max(MIN_NODE_H, rawH);
      nodes.push({ ...n, y, h });
      y += h + GAP;
    }
  }

  // ── Build link list ───────────────────────────────────────────────
  const rawLinks: { sourceId: string; targetId: string; value: number }[] = [];

  if (isMobile) {
    for (const [src, srcVal] of incomeSources) {
      const srcId = `inc:${src}`;
      if (!nodes.find(n => n.id === srcId)) continue;
      const totalCatVal = categories.reduce((s, [, v]) => s + v, 0);
      for (const [cat] of categories) {
        const catId = `cat:${cat}`;
        if (!nodes.find(n => n.id === catId)) continue;
        const linkVal = totalCatVal > 0 ? (expenseByCategory[cat] / totalCatVal) * srcVal : srcVal / categories.length;
        rawLinks.push({ sourceId: srcId, targetId: catId, value: linkVal });
      }
    }
  } else {
    for (const [src] of incomeSources) {
      const srcId = `inc:${src}`;
      for (const [acct] of accounts) {
        const v = incomeBySourceAccount[src]?.[acct] || 0;
        if (v > 0) rawLinks.push({ sourceId: srcId, targetId: `acct:${acct}`, value: v });
      }
    }
    for (const [acct] of accounts) {
      const srcId = `acct:${acct}`;
      if (!nodes.find(n => n.id === srcId)) continue;
      for (const [cat] of categories) {
        const v = expenseByAccount[acct]?.[cat] || 0;
        if (v > 0) rawLinks.push({ sourceId: srcId, targetId: `cat:${cat}`, value: v });
      }
    }
    for (const [cat] of categories) {
      const srcId = `cat:${cat}`;
      for (const [mer] of merchants) {
        const v = expenseByCategoryMerchant[cat]?.[mer] || 0;
        if (v > 0) rawLinks.push({ sourceId: srcId, targetId: `mer:${mer}`, value: v });
      }
    }
  }

  // ── Position ribbons within nodes ────────────────────────────────
  // Track consumed pixels at each node (outgoing from source, incoming to target)
  const srcConsumed: Record<string, number> = {};
  const tgtConsumed: Record<string, number> = {};

  const links: Link[] = [];
  for (const rl of rawLinks) {
    const srcNode = nodes.find(n => n.id === rl.sourceId);
    const tgtNode = nodes.find(n => n.id === rl.targetId);
    if (!srcNode || !tgtNode) continue;

    const srcTotal = rawLinks.filter(l => l.sourceId === rl.sourceId).reduce((s, l) => s + l.value, 0);
    const tgtTotal = rawLinks.filter(l => l.targetId === rl.targetId).reduce((s, l) => s + l.value, 0);

    // How many pixels of the node bar this ribbon occupies
    const srcBand = srcTotal > 0 ? (rl.value / srcTotal) * srcNode.h : 0;
    const tgtBand = tgtTotal > 0 ? (rl.value / tgtTotal) * tgtNode.h : 0;

    const srcUsed = srcConsumed[rl.sourceId] || 0;
    const tgtUsed = tgtConsumed[rl.targetId] || 0;

    links.push({
      sourceId: rl.sourceId,
      targetId: rl.targetId,
      value: rl.value,
      srcColor: srcNode.color,
      tgtColor: tgtNode.color,
      srcY0: srcNode.y + srcUsed,
      srcY1: srcNode.y + srcUsed + srcBand,
      tgtY0: tgtNode.y + tgtUsed,
      tgtY1: tgtNode.y + tgtUsed + tgtBand,
    });

    srcConsumed[rl.sourceId] = srcUsed + srcBand;
    tgtConsumed[rl.targetId] = tgtUsed + tgtBand;
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
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isMobile = width < 520;
  const svgH = isMobile ? 340 : 460;
  const colFracs = isMobile ? [0.03, 0.72] : [0.03, 0.31, 0.60, 0.84];
  const colLabels = isMobile ? COL_LABELS_2 : COL_LABELS_4;

  const { nodes, links } = useMemo(
    () => buildSankeyData(transactions, svgH, width, isMobile),
    [transactions, svgH, width, isMobile]
  );

  const handleNodeClick = (node: Node) => {
    if (node.id.startsWith('inc:'))  router.push(`/transactions?search=${encodeURIComponent(node.id.slice(4))}`);
    if (node.id.startsWith('acct:')) router.push(`/transactions?account=${encodeURIComponent(node.label)}`);
    if (node.id.startsWith('cat:'))  router.push(`/transactions?category=${encodeURIComponent(node.label)}`);
    if (node.id.startsWith('mer:'))  router.push(`/transactions?search=${encodeURIComponent(node.label)}`);
  };

  if (transactions.length === 0) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">No transaction data for this period</div>;
  }
  if (!nodes.some(n => n.column === 0)) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">No income/expense data in this period</div>;
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${width} ${svgH}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          {links.map((link, i) => (
            <linearGradient key={i} id={`lg-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={link.srcColor} stopOpacity={0.50} />
              <stop offset="100%" stopColor={link.tgtColor} stopOpacity={0.28} />
            </linearGradient>
          ))}
        </defs>

        {/* Column headers */}
        {colLabels.map((label, i) => (
          <text
            key={i}
            x={colFracs[i] * width + NODE_W / 2}
            y={14}
            textAnchor="middle"
            fontSize={9}
            fontWeight="700"
            letterSpacing="0.10em"
            fontFamily="var(--font-mono), monospace"
            style={{ fill: 'hsl(var(--muted-foreground))' }}
            className="select-none"
          >
            {label.toUpperCase()}
          </text>
        ))}

        {/* Ribbon links — filled paths with top + bottom bezier curves */}
        {links.map((link, i) => {
          const srcNode = nodes.find(n => n.id === link.sourceId)!;
          const tgtNode = nodes.find(n => n.id === link.targetId)!;
          if (!srcNode || !tgtNode) return null;

          const x1  = colFracs[srcNode.column] * width + NODE_W;
          const x2  = colFracs[tgtNode.column] * width;
          const cpX = (x1 + x2) / 2;

          // Filled ribbon: top edge left→right, then bottom edge right→left
          const d = [
            `M${x1},${link.srcY0}`,
            `C${cpX},${link.srcY0} ${cpX},${link.tgtY0} ${x2},${link.tgtY0}`,
            `L${x2},${link.tgtY1}`,
            `C${cpX},${link.tgtY1} ${cpX},${link.srcY1} ${x1},${link.srcY1}`,
            'Z',
          ].join(' ');

          const isHovered = hoveredNode === link.sourceId || hoveredNode === link.targetId;
          return (
            <path
              key={i}
              d={d}
              fill={`url(#lg-${i})`}
              fillOpacity={isHovered ? 0.72 : 0.38}
              className="transition-all duration-200"
            />
          );
        })}

        {/* Node bars */}
        {nodes.map(node => {
          const x = colFracs[node.column] * width;
          const isHovered = hoveredNode === node.id;
          const labelRight = node.column >= (isMobile ? 1 : 2);
          const label = truncate(node.label, isMobile ? 11 : 15);
          const showValue = isHovered || node.h > 30;

          return (
            <g
              key={node.id}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {/* Hover glow */}
              {isHovered && (
                <rect
                  x={x - 3} y={node.y - 3}
                  width={NODE_W + 6} height={node.h + 6}
                  rx={5} fill={node.color} opacity={0.18}
                />
              )}

              {/* Node bar */}
              <rect
                x={x} y={node.y}
                width={NODE_W} height={node.h}
                rx={3}
                fill={node.color}
                opacity={isHovered ? 1 : 0.85}
                className="transition-all duration-150"
              />

              {/* Label */}
              <text
                x={labelRight ? x - LABEL_PAD : x + NODE_W + LABEL_PAD}
                y={node.y + node.h / 2 - (showValue ? 6 : 0)}
                textAnchor={labelRight ? 'end' : 'start'}
                dominantBaseline="middle"
                fontSize={isMobile ? 9 : 11}
                fontFamily="var(--font-sans), system-ui"
                fontWeight={isHovered ? '700' : '500'}
                className="select-none transition-all duration-150"
                style={{ fill: isHovered ? node.color : 'hsl(var(--foreground) / 0.78)' }}
              >
                {label}
              </text>

              {/* Value */}
              {showValue && (
                <text
                  x={labelRight ? x - LABEL_PAD : x + NODE_W + LABEL_PAD}
                  y={node.y + node.h / 2 + (isMobile ? 8 : 9)}
                  textAnchor={labelRight ? 'end' : 'start'}
                  dominantBaseline="middle"
                  fontSize={isMobile ? 7.5 : 9}
                  fontFamily="var(--font-mono), monospace"
                  className="select-none"
                  style={{ fill: isHovered ? node.color : 'hsl(var(--muted-foreground))' }}
                >
                  {formatCurrency(node.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="text-[10px] text-center text-muted-foreground mt-1">
        Click any node to view matching transactions
      </p>
    </div>
  );
}
