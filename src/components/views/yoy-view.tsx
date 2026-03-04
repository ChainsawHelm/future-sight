'use client';

import { useFetch } from '@/hooks/use-fetch';
import { transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { EmptyState } from '@/components/shared/empty-state';
import { formatCurrency, cn } from '@/lib/utils';

export function YoYView() {
  const { data, error, isLoading, refetch } = useFetch(
    () => transactionsApi.list({ limit: 200, sort: 'date', order: 'asc' }), []
  );

  const txns = data?.transactions || [];

  if (isLoading) return <PageLoader message="Loading year-over-year..." />;
  if (error) return <ErrorAlert message={error} retry={refetch} />;
  if (txns.length === 0) return <EmptyState title="No data" description="Import transactions to see year-over-year comparison." />;

  // Group by year → month
  const yearData: Record<string, Record<number, { income: number; expense: number }>> = {};
  for (const t of txns) {
    const year = t.date.slice(0, 4);
    const month = parseInt(t.date.slice(5, 7));
    if (!yearData[year]) yearData[year] = {};
    if (!yearData[year][month]) yearData[year][month] = { income: 0, expense: 0 };
    if (t.amount > 0) yearData[year][month].income += t.amount;
    else yearData[year][month].expense += Math.abs(t.amount);
  }

  const years = Object.keys(yearData).sort().reverse();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Year totals
  const yearTotals = years.map(y => {
    const months = yearData[y];
    let income = 0, expense = 0;
    for (const m of Object.values(months)) { income += m.income; expense += m.expense; }
    return { year: y, income, expense, net: income - expense };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Year-over-Year</h1>
        <p className="text-sm text-muted-foreground mt-1">Compare financial performance across years</p>
      </div>

      {/* Year summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {yearTotals.map(({ year, income, expense, net }) => (
          <div key={year} className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-bold mb-3">{year}</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Income</span><span className="tabnum text-green-600 font-semibold">{formatCurrency(income)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Expenses</span><span className="tabnum text-red-600 font-semibold">{formatCurrency(expense)}</span></div>
              <div className="border-t pt-2 flex justify-between text-sm font-bold">
                <span>Net</span><span className={cn('tabnum', net >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(net)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly breakdown table */}
      {years.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">Month</th>
                {years.map(y => (
                  <th key={y} className="text-right px-4 py-3 font-medium" colSpan={2}>{y}</th>
                ))}
              </tr>
              <tr className="border-b text-xs text-muted-foreground">
                <th></th>
                {years.map(y => (
                  <><th key={`${y}-i`} className="text-right px-2 py-1">Income</th><th key={`${y}-e`} className="text-right px-4 py-1">Expenses</th></>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthNames.map((name, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-2.5 font-medium">{name}</td>
                  {years.map(y => {
                    const m = yearData[y]?.[i + 1];
                    return (
                      <>
                        <td key={`${y}-${i}-i`} className="text-right px-2 py-2.5 tabnum text-xs text-green-600">
                          {m?.income ? formatCurrency(m.income) : '—'}
                        </td>
                        <td key={`${y}-${i}-e`} className="text-right px-4 py-2.5 tabnum text-xs text-red-600">
                          {m?.expense ? formatCurrency(m.expense) : '—'}
                        </td>
                      </>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
