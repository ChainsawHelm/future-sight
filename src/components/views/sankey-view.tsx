'use client';

import { useEffect, useRef, useState } from 'react';
import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { getCategoryColor } from '@/components/shared/category-badge';
import { formatCurrency } from '@/lib/utils';

interface SankeyNode {
  name: string;
  type: 'income' | 'expense';
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export function SankeyView() {
  const { data, error, isLoading, refetch } = useFetch(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'desc' }), []
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const txns = data?.transactions || [];

  // Build Sankey data
  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  for (const t of txns) {
    if (t.amount > 0) {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    } else {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Math.abs(t.amount);
    }
  }

  const incomeCategories = Object.entries(incomeByCategory).sort(([, a], [, b]) => b - a).slice(0, 6);
  const expenseCategories = Object.entries(expenseByCategory).sort(([, a], [, b]) => b - a).slice(0, 10);

  useEffect(() => {
    if (!svgRef.current || incomeCategories.length === 0 || expenseCategories.length === 0) return;

    const width = svgRef.current.clientWidth || 700;
    const height = Math.max(400, (incomeCategories.length + expenseCategories.length) * 30);

    // Simple manual Sankey layout (no d3-sankey needed for this simplified version)
    const padding = 40;
    const nodeWidth = 18;
    const leftX = padding;
    const rightX = width - padding - nodeWidth;

    const totalIncome = incomeCategories.reduce((s, [, v]) => s + v, 0);
    const totalExpense = expenseCategories.reduce((s, [, v]) => s + v, 0);

    // Position income nodes (left)
    const incomeNodes: { name: string; y: number; height: number; value: number; color: string }[] = [];
    let yOffset = padding;
    const usableHeight = height - padding * 2;

    for (const [name, value] of incomeCategories) {
      const h = Math.max((value / totalIncome) * usableHeight * 0.9, 12);
      incomeNodes.push({ name, y: yOffset, height: h, value, color: getCategoryColor(name) });
      yOffset += h + 4;
    }

    // Position expense nodes (right)
    const expenseNodes: { name: string; y: number; height: number; value: number; color: string }[] = [];
    yOffset = padding;
    for (const [name, value] of expenseCategories) {
      const h = Math.max((value / totalExpense) * usableHeight * 0.9, 12);
      expenseNodes.push({ name, y: yOffset, height: h, value, color: getCategoryColor(name) });
      yOffset += h + 4;
    }

    // Clear and draw
    const svg = svgRef.current;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Draw links (each income → proportional to each expense)
    for (const inc of incomeNodes) {
      let incYUsed = 0;
      for (const exp of expenseNodes) {
        const proportion = exp.value / totalExpense;
        const linkHeight = inc.height * proportion;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const sy = inc.y + incYUsed + linkHeight / 2;
        const ty = exp.y + (exp.height * (inc.value / totalIncome)) / 2;

        const midX = (leftX + nodeWidth + rightX) / 2;
        const d = `M${leftX + nodeWidth},${sy} C${midX},${sy} ${midX},${ty + exp.height * incYUsed / inc.height} ${rightX},${ty + exp.height * incYUsed / inc.height}`;

        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', inc.color);
        path.setAttribute('stroke-opacity', '0.25');
        path.setAttribute('stroke-width', String(Math.max(linkHeight, 1)));
        path.style.transition = 'stroke-opacity 0.2s';
        path.addEventListener('mouseenter', () => { path.setAttribute('stroke-opacity', '0.6'); });
        path.addEventListener('mouseleave', () => { path.setAttribute('stroke-opacity', '0.25'); });
        svg.appendChild(path);

        incYUsed += linkHeight;
      }
    }

    // Draw income nodes
    for (const node of incomeNodes) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(leftX));
      rect.setAttribute('y', String(node.y));
      rect.setAttribute('width', String(nodeWidth));
      rect.setAttribute('height', String(node.height));
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', node.color);
      svg.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(leftX - 6));
      text.setAttribute('y', String(node.y + node.height / 2 + 4));
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', 'currentColor');
      text.setAttribute('class', 'fill-muted-foreground');
      text.textContent = `${node.name} ${formatCurrency(node.value)}`;
      svg.appendChild(text);
    }

    // Draw expense nodes
    for (const node of expenseNodes) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(rightX));
      rect.setAttribute('y', String(node.y));
      rect.setAttribute('width', String(nodeWidth));
      rect.setAttribute('height', String(node.height));
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', node.color);
      svg.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(rightX + nodeWidth + 6));
      text.setAttribute('y', String(node.y + node.height / 2 + 4));
      text.setAttribute('text-anchor', 'start');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', 'currentColor');
      text.setAttribute('class', 'fill-muted-foreground');
      text.textContent = `${node.name} ${formatCurrency(node.value)}`;
      svg.appendChild(text);
    }
  }, [txns, incomeCategories, expenseCategories]);

  if (isLoading) return <PageLoader message="Loading cash flow..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (txns.length === 0) return <EmptyState title="No data" description="Import transactions to see cash flow." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Cash Flow</h1>
        <p className="text-sm text-muted-foreground mt-1">How money flows from income to expenses</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm text-center">
          <p className="text-[11px] text-muted-foreground">Total Income</p>
          <p className="text-xl font-bold tabnum text-green-600">
            {formatCurrency(Object.values(incomeByCategory).reduce((s, v) => s + v, 0))}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm text-center">
          <p className="text-[11px] text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold tabnum text-red-600">
            {formatCurrency(Object.values(expenseByCategory).reduce((s, v) => s + v, 0))}
          </p>
        </div>
      </div>

      {/* Sankey diagram */}
      <div className="rounded-xl border bg-card p-5 shadow-sm overflow-x-auto">
        <svg ref={svgRef} className="w-full" style={{ minHeight: 400, minWidth: 600 }} />
      </div>
    </div>
  );
}
