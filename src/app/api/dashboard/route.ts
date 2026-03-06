import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { isRealIncome, isRealExpense, isDebtPayment } from '@/lib/classify';

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;
  const { userId } = result;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Previous month range for expense growth
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Same month last year for YoY
  const startOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0);

  // Last 6 months range for averages
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const [
    allTxns,
    monthTxns,
    lastMonthTxns,
    sameMonthLastYearTxns,
    last6MonthsTxns,
    goals,
    debts,
    assets,
    recentSnapshots,
  ] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true, category: true, transferPairId: true, returnPairId: true, description: true, account: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfLastMonth, lte: endOfLastMonth } },
      select: { amount: true, category: true, transferPairId: true, returnPairId: true, description: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfSameMonthLastYear, lte: endOfSameMonthLastYear } },
      select: { amount: true, category: true, transferPairId: true, returnPairId: true, description: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: sixMonthsAgo, lte: endOfMonth } },
      select: { amount: true, category: true, transferPairId: true, returnPairId: true, description: true, account: true, date: true },
    }),
    prisma.savingsGoal.findMany({
      where: { userId, status: 'active' },
      select: { name: true, targetAmount: true, currentAmount: true },
    }),
    prisma.debt.findMany({
      where: { userId, status: 'active' },
      select: { name: true, balance: true, originalBalance: true, minimumPayment: true, interestRate: true },
    }),
    prisma.asset.findMany({
      where: { userId },
      select: { name: true, value: true, type: true },
    }),
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 13,
      select: { date: true, netWorth: true, assets: true, liabilities: true },
    }),
  ]);

  const toTxn = (t: any) => ({ amount: Number(t.amount), category: t.category, transferPairId: t.transferPairId, returnPairId: t.returnPairId, description: t.description });

  // Current month
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyDebtPayments = 0;
  const categorySpending: Record<string, number> = {};
  const incomeBySource: Record<string, number> = {};

  for (const t of monthTxns) {
    const txn = toTxn(t);
    if (isRealIncome(txn)) {
      monthlyIncome += txn.amount;
      const src = t.category || 'Other';
      incomeBySource[src] = (incomeBySource[src] || 0) + txn.amount;
    } else if (isRealExpense(txn)) {
      monthlyExpenses += Math.abs(txn.amount);
      categorySpending[t.category] = (categorySpending[t.category] || 0) + Math.abs(txn.amount);
    }
    if (isDebtPayment(txn)) {
      monthlyDebtPayments += Math.abs(txn.amount);
    }
  }

  // Last month totals
  let lastMonthIncome = 0;
  let lastMonthExpenses = 0;
  for (const t of lastMonthTxns) {
    const txn = toTxn(t);
    if (isRealIncome(txn)) lastMonthIncome += txn.amount;
    else if (isRealExpense(txn)) lastMonthExpenses += Math.abs(txn.amount);
  }

  // Same month last year
  let yoyIncome = 0;
  let yoyExpenses = 0;
  for (const t of sameMonthLastYearTxns) {
    const txn = toTxn(t);
    if (isRealIncome(txn)) yoyIncome += txn.amount;
    else if (isRealExpense(txn)) yoyExpenses += Math.abs(txn.amount);
  }

  // 6-month averages
  let avg6Income = 0;
  let avg6Expenses = 0;
  for (const t of last6MonthsTxns) {
    const txn = toTxn(t);
    if (isRealIncome(txn)) avg6Income += txn.amount;
    else if (isRealExpense(txn)) avg6Expenses += Math.abs(txn.amount);
  }
  avg6Income /= 6;
  avg6Expenses /= 6;

  // Asset classification
  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalDebts = debts.reduce((s, d) => s + Number(d.balance), 0);
  const liquidAssets = assets
    .filter(a => ['checking', 'savings'].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);
  const investmentAssets = assets
    .filter(a => ['investment', 'retirement'].includes(a.type))
    .reduce((s, a) => s + Number(a.value), 0);

  // Housing cost (rent/mortgage categories)
  const housingCategories = ['Rent', 'Mortgage', 'Housing', 'Home'];
  const housingCost = Object.entries(categorySpending)
    .filter(([cat]) => housingCategories.some(h => cat.toLowerCase().includes(h.toLowerCase())))
    .reduce((s, [, v]) => s + v, 0);

  // Recurring expenses (subscriptions, rent/mortgage, insurance, utilities)
  const recurringCategories = ['Rent', 'Mortgage', 'Housing', 'Utilities', 'Insurance', 'Phone', 'Internet', 'Subscriptions', 'Streaming'];
  const recurringExpenses = Object.entries(categorySpending)
    .filter(([cat]) => recurringCategories.some(r => cat.toLowerCase().includes(r.toLowerCase())))
    .reduce((s, [, v]) => s + v, 0);

  // Total monthly debt payments (minimums from debt records)
  const totalMinPayments = debts.reduce((s, d) => s + Number(d.minimumPayment), 0);

  // NW growth
  const snapArr = recentSnapshots.map(s => ({ date: s.date.toISOString().slice(0, 10), netWorth: Number(s.netWorth), assets: Number(s.assets), liabilities: Number(s.liabilities) }));
  const nwGrowthMoM = snapArr.length >= 2
    ? { current: snapArr[0].netWorth, previous: snapArr[1].netWorth }
    : null;
  const nwGrowthYoY = snapArr.length >= 12
    ? { current: snapArr[0].netWorth, yearAgo: snapArr[11].netWorth }
    : null;

  // FIRE number (25x annual expenses)
  const annualExpenses = avg6Expenses * 12;
  const fireNumber = annualExpenses * 25;
  const fireProgress = fireNumber > 0 ? ((totalAssets - totalDebts) / fireNumber) * 100 : 0;

  // Emergency fund (months of expenses covered by liquid assets)
  const emergencyFundMonths = avg6Expenses > 0 ? liquidAssets / avg6Expenses : 0;

  // DTI (monthly debt obligations / monthly income)
  const dti = monthlyIncome > 0 ? (totalMinPayments / monthlyIncome) * 100 : 0;

  // Housing ratio
  const housingRatio = monthlyIncome > 0 ? (housingCost / monthlyIncome) * 100 : 0;

  // Expense growth rate MoM
  const expenseGrowthMoM = lastMonthExpenses > 0
    ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;

  // Expense growth YoY
  const expenseGrowthYoY = yoyExpenses > 0
    ? ((monthlyExpenses - yoyExpenses) / yoyExpenses) * 100
    : 0;

  // Investment categories in income
  const investmentIncomeCategories = ['Investment', 'Dividends', 'Interest', 'Capital Gains', 'Rental Income', 'Passive'];
  const passiveIncome = Object.entries(incomeBySource)
    .filter(([cat]) => investmentIncomeCategories.some(i => cat.toLowerCase().includes(i.toLowerCase())))
    .reduce((s, [, v]) => s + v, 0);

  // Investment rate (investment contributions as % of income — approximate via investment-type spending)
  const investmentCategories = ['Investment', 'Savings', '401k', 'IRA', 'Brokerage', 'Retirement'];
  const investmentContributions = Object.entries(categorySpending)
    .filter(([cat]) => investmentCategories.some(i => cat.toLowerCase().includes(i.toLowerCase())))
    .reduce((s, [, v]) => s + v, 0);

  // Cash flow runway
  const netMonthlyCashFlow = monthlyIncome - monthlyExpenses;
  const cashFlowRunwayMonths = netMonthlyCashFlow < 0 && liquidAssets > 0
    ? liquidAssets / Math.abs(netMonthlyCashFlow)
    : netMonthlyCashFlow >= 0 ? Infinity : 0;

  const r = (v: number) => Math.round(v * 100) / 100;

  return NextResponse.json({
    overview: {
      totalTransactions: allTxns,
      monthlyIncome: r(monthlyIncome),
      monthlyExpenses: r(monthlyExpenses),
      netSavings: r(monthlyIncome - monthlyExpenses),
      totalAssets: r(totalAssets),
      totalDebts: r(totalDebts),
      netWorth: r(totalAssets - totalDebts),
    },
    healthMetrics: {
      emergencyFundMonths: r(emergencyFundMonths),
      liquidAssets: r(liquidAssets),
      dti: r(dti),
      totalMinPayments: r(totalMinPayments),
      housingRatio: r(housingRatio),
      housingCost: r(housingCost),
      expenseGrowthMoM: r(expenseGrowthMoM),
      expenseGrowthYoY: r(expenseGrowthYoY),
      lastMonthExpenses: r(lastMonthExpenses),
      yoyExpenses: r(yoyExpenses),
      yoyIncome: r(yoyIncome),
      lastMonthIncome: r(lastMonthIncome),
    },
    wealthMetrics: {
      fireNumber: r(fireNumber),
      fireProgress: r(fireProgress),
      annualExpenses: r(annualExpenses),
      investmentAssets: r(investmentAssets),
      investmentRate: r(monthlyIncome > 0 ? (investmentContributions / monthlyIncome) * 100 : 0),
      investmentContributions: r(investmentContributions),
      passiveIncomeRatio: r(monthlyIncome > 0 ? (passiveIncome / monthlyIncome) * 100 : 0),
      passiveIncome: r(passiveIncome),
      nwGrowthMoM,
      nwGrowthYoY,
    },
    flexibilityMetrics: {
      recurringExpenses: r(recurringExpenses),
      discretionaryExpenses: r(monthlyExpenses - recurringExpenses),
      recurringRatio: r(monthlyExpenses > 0 ? (recurringExpenses / monthlyExpenses) * 100 : 0),
      incomeStreams: Object.keys(incomeBySource).length,
      incomeBySource,
      cashFlowRunwayMonths: cashFlowRunwayMonths === Infinity ? -1 : r(cashFlowRunwayMonths),
      netMonthlyCashFlow: r(netMonthlyCashFlow),
    },
    categorySpending,
    goals: goals.map((g) => ({
      name: g.name,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      progress: Number(g.targetAmount) > 0 ? Number(g.currentAmount) / Number(g.targetAmount) : 0,
    })),
    debts: debts.map((d) => ({
      name: d.name,
      balance: Number(d.balance),
      originalBalance: Number(d.originalBalance),
      progress: Number(d.originalBalance) > 0 ? 1 - Number(d.balance) / Number(d.originalBalance) : 0,
    })),
    recentNetWorth: snapArr,
  });
}
