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

  // Calculate component scores
  const components: ScoreComponent[] = [];

  // 1. Savings rate (0-25 pts)
  const savingsRate = overview.monthlyIncome > 0 ? overview.netSavings / overview.monthlyIncome : 0;
  const savingsScore = Math.min(Math.max(savingsRate * 100, 0), 25);
  components.push({ name: 'Savings Rate', score: Math.round(savingsScore), max: 25, description: `${(savingsRate * 100).toFixed(0)}% of income saved` });

  // 2. Debt-to-income (0-25 pts)
  const totalDebtPayments = debts.reduce((s, d) => s + d.minimumPayment + d.extraPayment, 0);
  const dti = overview.monthlyIncome > 0 ? totalDebtPayments / overview.monthlyIncome : 0;
  const dtiScore = Math.max(25 - dti * 50, 0);
  components.push({ name: 'Debt-to-Income', score: Math.round(dtiScore), max: 25, description: `${(dti * 100).toFixed(0)}% DTI ratio` });

  // 3. Budget adherence (0-25 pts)
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

  // 4. Emergency fund (0-25 pts)
  const emergencyTarget = overview.monthlyExpenses * 3;
  const emergencyRatio = emergencyTarget > 0 ? Math.min(overview.totalAssets / emergencyTarget, 1) : 0;
  const emergencyScore = Math.round(emergencyRatio * 25);
  components.push({ name: 'Emergency Fund', score: emergencyScore, max: 25, description: `${(emergencyRatio * 3).toFixed(1)} months of expenses covered` });

  const totalScore = components.reduce((s, c) => s + c.score, 0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const getArcColor = (score: number) => {
    if (score >= 80) return '#16A34A';
    if (score >= 60) return '#EAB308';
    if (score >= 40) return '#F97316';
    return '#EF4444';
  };

  // SVG arc for score display
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (totalScore / 100) * circumference;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Financial Health Score</h1>
        <p className="text-sm text-muted-foreground mt-1">A composite score based on your financial habits</p>
      </div>

      {/* Score circle */}
      <div className="rounded-xl border bg-card p-8 shadow-sm flex flex-col items-center">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="12" className="stroke-muted" />
            <circle
              cx="100" cy="100" r={radius} fill="none" strokeWidth="12"
              stroke={getArcColor(totalScore)}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - arcLength}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-4xl font-bold tabnum', getScoreColor(totalScore))}>{totalScore}</span>
            <span className="text-sm text-muted-foreground">{getScoreLabel(totalScore)}</span>
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {components.map((c) => (
          <div key={c.name} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">{c.name}</h3>
              <span className="text-sm font-bold tabnum">{c.score}/{c.max}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(c.score / c.max) * 100}%`, backgroundColor: getArcColor((c.score / c.max) * 100) }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{c.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
