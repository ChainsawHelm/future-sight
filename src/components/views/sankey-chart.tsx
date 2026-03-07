'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, cn } from '@/lib/utils';
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
  srcY0: number;
  srcY1: number;
  tgtY0: number;
  tgtY1: number;
}

/* ══════════════════════════════════════════════════════════════════
   COLORS
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
function catColor(cat: string) { return CAT_COLORS[cat] || '#6A7A9A'; }

/* ══════════════════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════════════════ */
const GAP        = 6;
const NODE_W     = 12;
const MIN_NODE_H = 18;
const LABEL_PAD  = 10;

// 3-column layout: Income | Accounts | Categories
const COL_FRACS_3 = [0.03, 0.35, 0.68];
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
  const heights = rawNodes.map(node =>
    Math.max(MIN_NODE_H, totalVal > 0 ? (node.value / totalVal) * drawH : drawH / n)
  );
  const total = heights.reduce((s, h) => s + h, 0);
  const scale = total > drawH ? drawH / total : 1;
  const scaled = heights.map(h => h * scale);
  let y = startY;
  return scaled.map(h => { const pos = { y, h }; y += h + GAP; return pos; });
}

interface MerchantData {
  merchant: string;
  amount: number;
}

interface BuildResult {
  nodes: Node[];
  links: Link[];
  maxColCount: number;
  merchantsByCategory: Record<string, MerchantData[]>;
}

function buildSankeyData(
  txns: TxnForSankey[],
  svgH: number,
  svgW: number,
  isMobile: boolean,
  showAll: boolean = false,
): BuildResult {
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

  const incomeLimit = showAll ? Infinity : 5;
  const accountLimit = showAll ? Infinity : 6;
  const categoryLimit = showAll ? Infinity : (isMobile ? 5 : 8);

  const incomeSources = Object.entries(incomeBySource).sort(([, a], [, b]) => b - a).slice(0, incomeLimit);
  const accounts = Object.entries(
    Object.keys(expenseByAccount).reduce((acc, acct) => {
      acc[acct] = Object.values(expenseByAccount[acct]).reduce((s, v) => s + v, 0);
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a).slice(0, accountLimit);
  const categories = Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a).slice(0, categoryLimit);

  const colFracs = isMobile ? COL_FRACS_2 : COL_FRACS_3;

  // 3 columns: Income (0), Accounts (1), Categories (2) — no merchants in SVG
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
  ];

  const numCols = isMobile ? 2 : 3;
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
  }

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
      sourceId: rl.sourceId, targetId: rl.targetId, value: rl.value,
      srcColor: srcNode.color, tgtColor: tgtNode.color,
      srcY0: srcNode.y + srcUsed, srcY1: srcNode.y + srcUsed + srcBand,
      tgtY0: tgtNode.y + tgtUsed, tgtY1: tgtNode.y + tgtUsed + tgtBand,
    });
    srcConsumed[rl.sourceId] = srcUsed + srcBand;
    tgtConsumed[rl.targetId] = tgtUsed + tgtBand;
  }

  const colCounts = [0, 0, 0];
  for (const n of nodes) colCounts[n.column] = (colCounts[n.column] || 0) + 1;
  const maxColCount = Math.max(...colCounts);

  // Build merchant breakdown per category for the detail panel
  const merchantsByCategory: Record<string, MerchantData[]> = {};
  for (const [cat, merchants] of Object.entries(expenseByCategoryMerchant)) {
    merchantsByCategory[cat] = Object.entries(merchants)
      .sort(([, a], [, b]) => b - a)
      .map(([merchant, amount]) => ({ merchant, amount }));
  }

  return { nodes, links, maxColCount, merchantsByCategory };
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════ */
interface SankeyChartProps {
  transactions: TxnForSankey[];
  period: string;
  dateFrom?: string;
  dateTo?: string;
  tall?: boolean;
}

const COL_LABELS_3 = ['Income', 'Accounts', 'Categories'];
const COL_LABELS_2 = ['Income', 'Spending'];

export function SankeyChart({ transactions, period, dateFrom, dateTo, tall }: SankeyChartProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isMobile = width < 520;
  const showAll = !!tall;
  const colFracs = isMobile ? COL_FRACS_2 : COL_FRACS_3;
  const colLabels = isMobile ? COL_LABELS_2 : COL_LABELS_3;

  const { nodes, links, svgH, merchantsByCategory } = useMemo(() => {
    const preliminary = buildSankeyData(transactions, 720, width, isMobile, showAll);
    const nodeCount = preliminary.maxColCount;
    const minH = isMobile ? 280 : (tall ? 600 : 360);
    const dynamicH = nodeCount * (MIN_NODE_H + GAP) + 16;
    const finalH = Math.max(minH, dynamicH);
    const result = buildSankeyData(transactions, finalH, width, isMobile, showAll);
    return { nodes: result.nodes, links: result.links, svgH: finalH, merchantsByCategory: result.merchantsByCategory };
  }, [transactions, width, isMobile, showAll, tall]);

  const dateSuffix = useMemo(() => {
    const parts = [
      dateFrom ? `dateFrom=${encodeURIComponent(dateFrom)}` : '',
      dateTo   ? `dateTo=${encodeURIComponent(dateTo)}`     : '',
    ].filter(Boolean).join('&');
    return parts ? `&${parts}` : '';
  }, [dateFrom, dateTo]);

  const handleNodeClick = (node: Node) => {
    // Category nodes toggle the merchant expansion panel
    if (node.id.startsWith('cat:')) {
      const cat = node.label;
      setExpandedCategory(prev => prev === cat ? null : cat);
      return;
    }
    if (node.id.startsWith('inc:'))  router.push(`/transactions?search=${encodeURIComponent(node.id.slice(4))}${dateSuffix}`);
    if (node.id.startsWith('acct:')) router.push(`/transactions?account=${encodeURIComponent(node.label)}${dateSuffix}`);
  };

  // Reset expanded category when period changes
  useEffect(() => { setExpandedCategory(null); }, [period]);

  if (transactions.length === 0) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No transaction data for this period</div>;
  }
  if (!nodes.some(n => n.column === 0)) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No income/expense data in this period</div>;
  }

  const expandedMerchants = expandedCategory ? merchantsByCategory[expandedCategory] || [] : [];
  const expandedTotal = expandedMerchants.reduce((s, m) => s + m.amount, 0);

  return (
    <div ref={containerRef} className="w-full">
      {/* Column headers */}
      <div className="relative h-5 mb-1 select-none">
        {colLabels.map((label, i) => {
          const pct = colFracs[i] * 100;
          return (
            <span
              key={i}
              className="absolute text-[9px] font-bold tracking-[0.10em] text-muted-foreground"
              style={{ left: `${pct}%` }}
            >
              {label.toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* SVG */}
      <div className="w-full overflow-hidden">
        <svg
          width="100%"
          height={svgH}
          viewBox={`0 0 ${width} ${svgH}`}
          preserveAspectRatio="xMinYMin meet"
        >
          <defs>
            {links.map((link, i) => (
              <linearGradient key={i} id={`lg-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={link.srcColor} stopOpacity={0.52} />
                <stop offset="100%" stopColor={link.tgtColor} stopOpacity={0.28} />
              </linearGradient>
            ))}
          </defs>

          {/* Ribbons */}
          {links.map((link, i) => {
            const srcNode = nodes.find(n => n.id === link.sourceId)!;
            const tgtNode = nodes.find(n => n.id === link.targetId)!;
            if (!srcNode || !tgtNode) return null;

            const x1  = colFracs[srcNode.column] * width + NODE_W;
            const x2  = colFracs[tgtNode.column] * width;
            const cpX = (x1 + x2) / 2;

            const d = [
              `M${x1},${link.srcY0}`,
              `C${cpX},${link.srcY0} ${cpX},${link.tgtY0} ${x2},${link.tgtY0}`,
              `L${x2},${link.tgtY1}`,
              `C${cpX},${link.tgtY1} ${cpX},${link.srcY1} ${x1},${link.srcY1}`,
              'Z',
            ].join(' ');

            const isHovered = hoveredNode === link.sourceId || hoveredNode === link.targetId;
            const isExpanded = expandedCategory && link.targetId === `cat:${expandedCategory}`;
            return (
              <path
                key={i}
                d={d}
                fill={`url(#lg-${i})`}
                fillOpacity={isExpanded ? 0.75 : isHovered ? 0.70 : 0.38}
                className="transition-opacity duration-200"
              />
            );
          })}

          {/* Node bars */}
          {nodes.map(node => {
            const x = colFracs[node.column] * width;
            const isHovered = hoveredNode === node.id;
            const isExpanded = expandedCategory && node.id === `cat:${expandedCategory}`;
            const isCatNode = node.id.startsWith('cat:');

            // Categories: labels go right of bar (plenty of room now with no col 3)
            const labelX = x + NODE_W + LABEL_PAD;
            const anchor = 'start';
            const maxChars = isMobile ? 11 : 18;
            const label   = truncate(node.label, maxChars);
            const showVal = isHovered || isExpanded || node.h > 26;
            const midY    = node.y + node.h / 2;

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {(isHovered || isExpanded) && (
                  <rect
                    x={x - 2} y={node.y - 2}
                    width={NODE_W + 4} height={node.h + 4}
                    rx={4} fill={node.color} opacity={0.20}
                  />
                )}

                <rect
                  x={x} y={node.y}
                  width={NODE_W} height={node.h}
                  rx={3}
                  fill={node.color}
                  opacity={isHovered || isExpanded ? 1 : 0.85}
                  style={{ transition: 'opacity 0.15s' }}
                />

                <text
                  x={labelX}
                  y={showVal ? midY - 6 : midY}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize={isMobile ? 9 : 11}
                  fontFamily="var(--font-sans), system-ui"
                  fontWeight={isHovered || isExpanded ? '700' : '500'}
                  style={{
                    fill: isHovered || isExpanded ? node.color : 'hsl(var(--foreground) / 0.78)',
                    transition: 'fill 0.15s',
                    userSelect: 'none',
                  }}
                >
                  {label}
                  {isCatNode && !isMobile && (
                    <tspan fontSize={9} fill="hsl(var(--muted-foreground))">{isExpanded ? ' ▾' : ' ▸'}</tspan>
                  )}
                </text>

                {showVal && (
                  <text
                    x={labelX}
                    y={midY + 7}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize={isMobile ? 7.5 : 9}
                    fontFamily="var(--font-mono), monospace"
                    style={{
                      fill: isHovered || isExpanded ? node.color : 'hsl(var(--muted-foreground))',
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
        Click a category to expand merchants · Click income or account to view transactions
      </p>

      {/* ═══ Merchant Expansion Panel ═══ */}
      {expandedCategory && expandedMerchants.length > 0 && (
        <div className="mt-3 border border-border bg-surface-1 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catColor(expandedCategory) }} />
              <span className="text-sm font-semibold">{expandedCategory}</span>
              <span className="ticker text-[10px]">{expandedMerchants.length} merchant{expandedMerchants.length !== 1 ? 's' : ''} · {formatCurrency(expandedTotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/transactions?category=${encodeURIComponent(expandedCategory)}${dateSuffix}`)}
                className="text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
              >
                View Transactions →
              </button>
              <button
                onClick={() => setExpandedCategory(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {expandedMerchants.map((m, i) => {
              const pct = expandedTotal > 0 ? (m.amount / expandedTotal) * 100 : 0;
              return (
                <button
                  key={m.merchant}
                  onClick={() => router.push(`/transactions?search=${encodeURIComponent(m.merchant)}${dateSuffix}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-2/50 transition-colors text-left group"
                >
                  <span className="text-[10px] font-mono text-muted-foreground/50 w-5 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono truncate group-hover:text-primary transition-colors">{m.merchant}</span>
                      <span className="tabnum text-xs font-semibold shrink-0 ml-2">{formatCurrency(m.amount)}</span>
                    </div>
                    <div className="h-1 bg-surface-2 overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: catColor(expandedCategory) }}
                      />
                    </div>
                  </div>
                  <span className="tabnum text-[10px] text-muted-foreground/60 w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
