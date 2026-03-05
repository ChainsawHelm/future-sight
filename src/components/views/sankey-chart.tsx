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
  y: number;
  h: number;
}

interface Link {
  sourceId: string;
  targetId: string;
  value: number;
  srcColor: string;
  tgtColor: string;
  srcY0: number;   // top of ribbon at source
  srcY1: number;   // bottom of ribbon at source
  tgtY0: number;   // top of ribbon at target
  tgtY1: number;   // bottom of ribbon at target
}

/* ══════════════════════════════════════════════════════════════════
   COLORS — GLASSHOUSE palette
══════════════════════════════════════════════════════════════════ */
const INCOME_COLOR   = '#4E8B62';
const ACCOUNT_COLORS = ['#3D7A8A', '#4A90A4', '#2E7D9A', '#4A7E6E', '#5A8A7A', '#326E84'];
const CAT_COLORS: Record<string, string> = {
  Groceries: '#4A8C5C', Dining: '#C4883A', Shopping: '#4A7AB0',
  Transportation: '#5A72B0', Housing: '#A04A72', Utilities: '#3A9A9A',
  Healthcare: '#B04A4A', Entertainment: '#7A5AB0', Subscriptions: '#3A9AB0',
  Gas: '#C47A3A', Travel: '#3A85B0', Education: '#7A9A3A',
  Fitness: '#4A9A5A', 'Personal Care': '#A04A6A', Business: '#5A7A8A',
  Charity: '#A04A8A', Savings: '#3A9A6A', Phone: '#4A6AB0',
  Insurance: '#7A6A5A', Restaurants: '#C47A5A',
  'ATM & Fees': '#8A9AA8', Uncategorized: '#9AA0A8',
};
const MERCHANT_COLOR = '#7B8FA6';
function catColor(cat: string) { return CAT_COLORS[cat] || '#6A7A9A'; }

/* ══════════════════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════════════════ */
const GAP        = 7;
const NODE_W     = 12;
const MIN_NODE_H = 20;
const LABEL_PAD  = 10;

// Column fractions: where each column's node bar starts (left edge)
const COL_FRACS_4 = [0.03, 0.31, 0.60, 0.84];
const COL_FRACS_2 = [0.03, 0.74];

function simplifyMerchant(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?/g, '')
    .replace(/\b(PURCHASE|PAYMENT|DEBIT|POS|ACH|REF\w*|TXN\w*|#\w+)\b/g, '')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean).slice(0, 3).join(' ')
    || desc.slice(0, 20).toUpperCase();
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function stackColumn(
  rawNodes: Omit<Node, 'y' | 'h'>[],
  totalVal: number,
  availH: number,
  startY: number,
): { y: number; h: number }[] {
  const n = rawNodes.length;
  if (n === 0) return [];
  const totalGaps = GAP * (n - 1);
  const drawH = Math.max(0, availH - totalGaps);

  // Raw heights → clamp to min
  const heights = rawNodes.map(node =>
    Math.max(MIN_NODE_H, totalVal > 0 ? (node.value / totalVal) * drawH : drawH / n)
  );

  // Scale down if total overflows the available space
  const total = heights.reduce((s, h) => s + h, 0);
  const scale = total > drawH ? drawH / total : 1;
  const scaled = heights.map(h => h * scale);

  let y = startY;
  return scaled.map(h => { const pos = { y, h }; y += h + GAP; return pos; });
}

function buildSankeyData(
  txns: TxnForSankey[],
  svgH: number,
  svgW: number,
  isMobile: boolean,
): { nodes: Node[]; links: Link[] } {
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
      const m = simplifyMerchant(t.description);
      if (!expenseByCategoryMerchant[t.category]) expenseByCategoryMerchant[t.category] = {};
      expenseByCategoryMerchant[t.category][m] = (expenseByCategoryMerchant[t.category][m] || 0) + amt;
    }
  }

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

  const colFracs = isMobile ? COL_FRACS_2 : COL_FRACS_4;

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

  const numCols = isMobile ? 2 : 4;
  // Reserve 8px top and 8px bottom padding inside the SVG
  const availH = svgH - 16;
  const startY = 8;

  const nodes: Node[] = [];
  for (let col = 0; col < numCols; col++) {
    const colNodes = rawNodes.filter(n => n.column === col);
    if (!colNodes.length) continue;
    const totalVal = colNodes.reduce((s, n) => s + n.value, 0);
    const positions = stackColumn(colNodes, totalVal, availH, startY);
    colNodes.forEach((n, i) => nodes.push({ ...n, ...positions[i] }));
  }

  // Build raw link list
  const rawLinks: { sourceId: string; targetId: string; value: number }[] = [];

  if (isMobile) {
    for (const [src, srcVal] of incomeSources) {
      const srcId = `inc:${src}`;
      if (!nodes.find(n => n.id === srcId)) continue;
      const totalCatVal = categories.reduce((s, [, v]) => s + v, 0);
      for (const [cat] of categories) {
        const catId = `cat:${cat}`;
        if (!nodes.find(n => n.id === catId)) continue;
        const v = totalCatVal > 0 ? (expenseByCategory[cat] / totalCatVal) * srcVal : srcVal / categories.length;
        rawLinks.push({ sourceId: srcId, targetId: catId, value: v });
      }
    }
  } else {
    for (const [src] of incomeSources) {
      for (const [acct] of accounts) {
        const v = incomeBySourceAccount[src]?.[acct] || 0;
        if (v > 0) rawLinks.push({ sourceId: `inc:${src}`, targetId: `acct:${acct}`, value: v });
      }
    }
    for (const [acct] of accounts) {
      if (!nodes.find(n => n.id === `acct:${acct}`)) continue;
      for (const [cat] of categories) {
        const v = expenseByAccount[acct]?.[cat] || 0;
        if (v > 0) rawLinks.push({ sourceId: `acct:${acct}`, targetId: `cat:${cat}`, value: v });
      }
    }
    for (const [cat] of categories) {
      for (const [mer] of merchants) {
        const v = expenseByCategoryMerchant[cat]?.[mer] || 0;
        if (v > 0) rawLinks.push({ sourceId: `cat:${cat}`, targetId: `mer:${mer}`, value: v });
      }
    }
  }

  // Position ribbons within nodes
  const srcConsumed: Record<string, number> = {};
  const tgtConsumed: Record<string, number> = {};
  const links: Link[] = [];

  for (const rl of rawLinks) {
    const srcNode = nodes.find(n => n.id === rl.sourceId);
    const tgtNode = nodes.find(n => n.id === rl.targetId);
    if (!srcNode || !tgtNode) continue;

    const srcTotal = rawLinks.filter(l => l.sourceId === rl.sourceId).reduce((s, l) => s + l.value, 0);
    const tgtTotal = rawLinks.filter(l => l.targetId === rl.targetId).reduce((s, l) => s + l.value, 0);

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
   COMPONENT
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
  const svgH = isMobile ? 280 : 360;
  const colFracs = isMobile ? COL_FRACS_2 : COL_FRACS_4;
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
    return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No transaction data for this period</div>;
  }
  if (!nodes.some(n => n.column === 0)) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No income/expense data in this period</div>;
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* ── TEMP FONT DEMO — remove once font is chosen ── */}
      <div className="mb-4 p-3 rounded-lg border border-border bg-surface-2">
        <p className="text-[9px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Font preview — tell me which one you like</p>
        <div className="grid grid-cols-5 gap-2">
          {[
            { name: 'Inter',         fontVar: 'var(--font-sans)' },
            { name: 'Plus Jakarta',  fontVar: 'var(--font-jakarta)' },
            { name: 'DM Sans',       fontVar: 'var(--font-dm-sans)' },
            { name: 'Outfit',        fontVar: 'var(--font-outfit)' },
            { name: 'Figtree',       fontVar: 'var(--font-figtree)' },
          ].map(f => (
            <div key={f.name} className="rounded-md border border-border bg-card p-2 text-center">
              <p className="text-[8px] font-mono text-muted-foreground mb-1.5">{f.name}</p>
              <p style={{ fontFamily: f.fontVar }} className="text-sm font-semibold text-foreground leading-tight">Future Sight</p>
              <p style={{ fontFamily: f.fontVar }} className="text-xs text-muted-foreground mt-0.5">$6,400.00</p>
              <p style={{ fontFamily: f.fontVar }} className="text-[10px] text-muted-foreground">Net worth tracker</p>
            </div>
          ))}
        </div>
      </div>
      {/* ── END FONT DEMO ── */}

      {/* Column headers — absolutely positioned over the SVG */}
      <div className="relative h-5 mb-1 select-none">
        {colLabels.map((label, i) => {
          const pct = colFracs[i] * 100;
          const isLast = i === colLabels.length - 1;
          return (
            <span
              key={i}
              className="absolute text-[9px] font-bold tracking-[0.10em] text-muted-foreground"
              style={
                isLast
                  ? { right: `${(1 - colFracs[i] - NODE_W / width) * 100}%`, textAlign: 'right' }
                  : { left: `${pct}%` }
              }
            >
              {label.toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* SVG — clipped to its bounds */}
      <div className="w-full overflow-hidden">
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${width} ${svgH}`}
          preserveAspectRatio="none"
        >
          <defs>
            {links.map((link, i) => (
              <linearGradient key={i} id={`lg-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={link.srcColor} stopOpacity={0.52} />
                <stop offset="100%" stopColor={link.tgtColor} stopOpacity={0.28} />
              </linearGradient>
            ))}
          </defs>

          {/* Ribbon links — filled paths */}
          {links.map((link, i) => {
            const srcNode = nodes.find(n => n.id === link.sourceId)!;
            const tgtNode = nodes.find(n => n.id === link.targetId)!;
            if (!srcNode || !tgtNode) return null;

            const x1  = colFracs[srcNode.column] * width + NODE_W;
            const x2  = colFracs[tgtNode.column] * width;
            const cpX = (x1 + x2) / 2;

            // Top edge: source top → target top (left to right)
            // Bottom edge: target bottom → source bottom (right to left)
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
                fillOpacity={isHovered ? 0.70 : 0.38}
                className="transition-opacity duration-200"
              />
            );
          })}

          {/* Node bars */}
          {nodes.map(node => {
            const x = colFracs[node.column] * width;
            const isHovered = hoveredNode === node.id;
            // Labels: cols 0 & 1 go to the right of the node, cols 2 & 3 go to the left
            const labelRight = node.column >= (isMobile ? 1 : 2);
            const labelX = labelRight ? x - LABEL_PAD : x + NODE_W + LABEL_PAD;
            const anchor  = labelRight ? 'end' : 'start';
            const label   = truncate(node.label, isMobile ? 11 : 14);
            const showVal = isHovered || node.h > 28;
            const midY    = node.y + node.h / 2;

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Subtle glow on hover */}
                {isHovered && (
                  <rect
                    x={x - 2} y={node.y - 2}
                    width={NODE_W + 4} height={node.h + 4}
                    rx={4} fill={node.color} opacity={0.20}
                  />
                )}

                {/* Node bar */}
                <rect
                  x={x} y={node.y}
                  width={NODE_W} height={node.h}
                  rx={3}
                  fill={node.color}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: 'opacity 0.15s' }}
                />

                {/* Label */}
                <text
                  x={labelX}
                  y={showVal ? midY - 6 : midY}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={isMobile ? 9 : 11}
                  fontFamily="var(--font-sans), system-ui"
                  fontWeight={isHovered ? '700' : '500'}
                  style={{
                    fill: isHovered ? node.color : 'hsl(var(--foreground) / 0.78)',
                    transition: 'fill 0.15s',
                    userSelect: 'none',
                  }}
                >
                  {label}
                </text>

                {/* Value sub-label */}
                {showVal && (
                  <text
                    x={labelX}
                    y={midY + 7}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize={isMobile ? 7.5 : 9}
                    fontFamily="var(--font-mono), monospace"
                    style={{
                      fill: isHovered ? node.color : 'hsl(var(--muted-foreground))',
                      transition: 'fill 0.15s',
                      userSelect: 'none',
                    }}
                  >
                    {formatCurrency(node.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-[10px] text-center text-muted-foreground mt-2">
        Click any node to filter transactions
      </p>
    </div>
  );
}
