import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [
    allTxns,
    monthTxns,
    goals,
    debts,
    assets,
    recentSnapshots,
  ] = await Promise.all([
    // Total transaction count
    prisma.transaction.count({ where: { userId } }),
    // This month's transactions
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { amount: true, category: true },
    }),
    // Active goals summary
    prisma.savingsGoal.findMany({
      where: { userId, status: 'active' },
      select: { name: true, targetAmount: true, currentAmount: true },
    }),
    // Active debts summary
    prisma.debt.findMany({
      where: { userId, status: 'active' },
      select: { name: true, balance: true, originalBalance: true },
    }),
    // Assets
    prisma.asset.findMany({
      where: { userId },
      select: { name: true, value: true, type: true },
    }),
    // Latest net worth snapshot
    prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 2,
      select: { date: true, netWorth: true },
    }),
  ]);

  // Calculate monthly income/expenses
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  const categorySpending: Record<string, number> = {};

  for (const t of monthTxns) {
    const amt = Number(t.amount);
    if (amt > 0) {
      monthlyIncome += amt;
    } else {
      monthlyExpenses += Math.abs(amt);
      categorySpending[t.category] = (categorySpending[t.category] || 0) + Math.abs(amt);
    }
  }

  const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
  const totalDebts = debts.reduce((s, d) => s + Number(d.balance), 0);

  return NextResponse.json({
    overview: {
      totalTransactions: allTxns,
      monthlyIncome: Math.round(monthlyIncome * 100) / 100,
      monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
      netSavings: Math.round((monthlyIncome - monthlyExpenses) * 100) / 100,
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalDebts: Math.round(totalDebts * 100) / 100,
      netWorth: Math.round((totalAssets - totalDebts) * 100) / 100,
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
    recentNetWorth: recentSnapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      netWorth: Number(s.netWorth),
    })),
  });
}
