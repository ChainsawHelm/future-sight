'use client';

import { useFetch } from '@/hooks/use-fetch';
import { dashboardApi, debtsApi, budgetsApi, transactionsApi } from '@/lib/api-client';
import { PageLoader } from '@/components/shared/spinner';
import { ErrorAlert } from '@/components/shared/error-alert';
import { cn } from '@/lib/utils';

interface ScoreComponent {
  name: string;
  score: number;
  max: number;
  description: string;
}

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return 'hsl(var(--primary))';
  if (score >= 60) return '#facc15';
  if (score >= 40) return '#fb923c';
  return 'hsl(var(--expense))';
};

const SCORE_LABEL = (score: number) => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
};

export function HealthScoreView() {
  const { data: dash, isLoading: l1, error: e1 } = useFetch(() => dashboardApi.get(), []);
  const { data: debtsData, isLoading: l2 } = useFetch(() => debtsApi.list(), []);
  const { data: budgetData, isLoading: l3 } = useFetch(() => budgetsApi.list(), []);
  const { data: txnData, isLoading: l4 } = useFetch(() => transactionsApi.list({ limit: 200 }), []);

  if (l1 || l2 || l3 || l4) return <PageLoader message="Calculating health score..." />;
  if (e1) return <ErrorAlert message={e1} />;
  if (!dash) return null;

  const overview = dash.overview;
  const debts = debtsData?.debts || [];
  const budgets = budgetData?.budgets || [];
  const txns = txnData?.transactions || [];

  const components: ScoreComponent[] = [];

  // Savings rate (0-25 pts)
  const savingsRate = overview.monthlyIncome > 0 ? overview.netSavings / overview.monthlyIncome : 0;
  const savingsScore = Math.min(Math.max(savingsRate * 100, 0), 25);
  components.push({ name: 'Savings Rate', score: Math.round(savingsScore), max: 25, description: `${(savingsRate * 100).toFixed(0)}% of income saved` });

  // Debt-to-income (0-25 pts)
  const totalDebtPayments = debts.reduce((s, d) => s + d.minimumPayment + d.extraPayment, 0);
  const dti = overview.monthlyIncome > 0 ? totalDebtPayments / overview.monthlyIncome : 0;
  const dtiScore = Math.max(25 - dti * 50, 0);
  components.push({ name: 'Debt-to-Income', score: Math.round(dtiScore), max: 25, description: `${(dti * 100).toFixed(0)}% DTI ratio` });

  // Budget adherence (0-25 pts)
  let budgetAdherence = budgets.length > 0 ? 25 : 12;
  if (budgets.length > 0) {
    const spending: Record<string, number> = {};
    for (const t of txns) {
      if (t.amount < 0) spending[t.category] = (spending[t.category] || 0) + Math.abs(t.amount);
    }
    let onBudget = 0;
    for (const b of budgets) {
      if ((spending[b.category] || 0) <= b.monthlyLimit) onBudget++;
    }
    budgetAdherence = Math.round((onBudget / budgets.length) * 25);
  }
  components.push({ name: 'Budget Adherence', score: budgetAdherence, max: 25, description: budgets.length > 0 ? `${budgetAdherence} of 25 categories on budget` : 'No budgets set' });

  // Emergency fund (0-25 pts)
  const emergencyTarget = overview.monthlyExpenses * 3;
  const emergencyRatio = emergencyTarget > 0 ? Math.min(overview.totalAssets / emergencyTarget, 1) : 0;
  const emergencyScore = Math.round(emergencyRatio * 25);
  components.push({ name: 'Emergency Fund', score: emergencyScore, max: 25, description: `${(emergencyRatio * 3).toFixed(1)} months of expenses covered` });

  const totalScore = components.reduce((s, c) => s + c.score, 0);

  // SVG arc
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (totalScore / 100) * circumference;
  const arcColor = SCORE_COLOR(totalScore);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="border border-border bg-surface-1 px-5 py-4">
        <p className="ticker mb-1">Diagnostics</p>
        <h1 className="text-xl font-bold tracking-tight">Financial Health Score</h1>
      </div>

      {/* Score dial */}
      <div className="border border-border bg-surface-1 p-8 flex flex-col items-center">
        <div className="relative w-52 h-52 mb-6">
          {/* Dot grid behind dial */}
          <div className="absolute inset-0 dot-grid opacity-30 rounded-full overflow-hidden" />

          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="10"
              stroke="hsl(var(--surface-3))" />
            {/* Arc */}
            <circle
              cx="100" cy="100" r={radius} fill="none" strokeWidth="10"
              stroke={arcColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - arcLength}
              className="transition-all duration-1000"
              style={{ filter: `drop-shadow(0 0 10px ${arcColor}60)` }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="numeral text-5xl font-bold tabnum" style={{ color: arcColor }}>
              {totalScore}
            </span>
            <span className="ticker mt-1" style={{ color: arcColor }}>
              {SCORE_LABEL(totalScore)}
            </span>
          </div>
        </div>

        {/* Score tiers legend */}
        <div className="flex items-center gap-6">
          {[
            { label: 'Needs Work', range: '0–39', color: 'hsl(var(--expense))' },
            { label: 'Fair', range: '40–59', color: '#fb923c' },
            { label: 'Good', range: '60–79', color: '#facc15' },
            { label: 'Excellent', range: '80+', color: 'hsl(var(--primary))' },
          ].map((tier) => (
            <div key={tier.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2" style={{ backgroundColor: tier.color }} />
              <div>
                <p className="font-mono text-[9px] font-semibold" style={{ color: tier.color }}>{tier.label}</p>
                <p className="font-mono text-[9px] text-muted-foreground">{tier.range}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {components.map((c, i) => {
          const pct = (c.score / c.max) * 100;
          const color = SCORE_COLOR(pct);

          return (
            <div key={c.name} className="border border-border bg-surface-1 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color }} />

              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="ticker mb-0.5">Component {String(i + 1).padStart(2, '0')}</p>
                  <h3 className="text-sm font-bold">{c.name}</h3>
                </div>
                <div className="text-right">
                  <span className="numeral text-2xl font-bold tabnum" style={{ color }}>
                    {c.score}
                  </span>
                  <span className="ticker ml-1">/{c.max}</span>
                </div>
              </div>

              <div className="h-1.5 bg-surface-3 overflow-hidden mb-2">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 6px ${color}50`,
                  }}
                />
              </div>

              <p className="ticker">{c.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
