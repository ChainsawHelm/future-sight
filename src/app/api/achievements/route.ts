import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { evaluateAchievements, ALL_ACHIEVEMENTS } from '@/lib/achievements';
import type { AchievementContext } from '@/lib/achievements';

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const userId = result.userId;

  try {
    // Gather all data in parallel
    const [
      user,
      txnCounts,
      txnDates,
      incomeTxns,
      expenseTxns,
      categories,
      accounts,
      goals,
      debtsActive,
      debtsAll,
      assets,
      budgets,
      budgetTxns,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      prisma.transaction.count({ where: { userId } }),
      prisma.transaction.findMany({
        where: { userId },
        select: { date: true, amount: true, category: true },
        orderBy: { date: 'asc' },
      }),
      prisma.transaction.count({ where: { userId, amount: { gt: 0 } } }),
      prisma.transaction.count({ where: { userId, amount: { lt: 0 } } }),
      prisma.transaction.groupBy({ by: ['category'], where: { userId }, _count: true }),
      prisma.transaction.groupBy({ by: ['account'], where: { userId }, _count: true }),
      prisma.savingsGoal.findMany({
        where: { userId },
        select: { targetAmount: true, currentAmount: true, status: true },
      }),
      prisma.debt.findMany({
        where: { userId, status: 'active' },
        select: { balance: true, originalBalance: true },
      }),
      prisma.debt.findMany({
        where: { userId },
        select: { balance: true, originalBalance: true, status: true },
      }),
      prisma.asset.findMany({
        where: { userId },
        select: { value: true, type: true },
      }),
      prisma.budget.findMany({
        where: { userId },
        select: { category: true, monthlyLimit: true },
      }),
      // Get all expense transactions for budget compliance calculation
      prisma.transaction.findMany({
        where: { userId, amount: { lt: 0 } },
        select: { date: true, amount: true, category: true },
      }),
    ]);

    // ─── Compute context values ───

    const totalTxns = txnCounts;
    const totalIncomeTxns = incomeTxns;
    const totalExpenseTxns = expenseTxns;
    const uniqueCategories = categories.length;
    const uniqueAccounts = accounts.length;

    // Oldest transaction age
    const oldestDate = txnDates.length > 0 ? new Date(txnDates[0].date) : new Date();
    const oldestTxnDays = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

    // Goals
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.status === 'completed' || Number(g.currentAmount) >= Number(g.targetAmount)).length;
    const totalSaved = goals.reduce((s, g) => s + Number(g.currentAmount), 0);
    const largestGoal = goals.reduce((max, g) => Math.max(max, Number(g.targetAmount)), 0);

    // Debts
    const totalDebts = debtsAll.length;
    const paidOffDebts = debtsAll.filter(d => d.status === 'paid_off' || Number(d.balance) <= 0).length;
    const totalDebtBalance = debtsActive.reduce((s, d) => s + Number(d.balance), 0);
    const totalDebtOriginal = debtsAll.reduce((s, d) => s + Number(d.originalBalance), 0);
    const debtPayoffPercent = totalDebtOriginal > 0 ? ((totalDebtOriginal - totalDebtBalance) / totalDebtOriginal) * 100 : 0;
    const isDebtFree = debtsAll.length > 0 && debtsActive.every(d => Number(d.balance) <= 0);
    const hasDebts = debtsAll.length > 0;

    // Assets & net worth
    const totalAssets = assets.reduce((s, a) => s + Number(a.value), 0);
    const assetTypes = new Set(assets.map(a => a.type)).size;
    const netWorth = totalAssets - totalDebtBalance;

    // Monthly income/expenses from recent month
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    for (const t of txnDates) {
      const d = new Date(t.date);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (m === thisMonth) {
        const amt = Number(t.amount);
        if (amt > 0) monthlyIncome += amt;
        else monthlyExpenses += Math.abs(amt);
      }
    }
    const netSavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? netSavings / monthlyIncome : 0;

    // Budget compliance per month
    const budgetMap: Record<string, number> = {};
    for (const b of budgets) budgetMap[b.category] = Number(b.monthlyLimit);

    const monthlySpending: Record<string, Record<string, number>> = {};
    for (const t of budgetTxns) {
      const d = new Date(t.date);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlySpending[m]) monthlySpending[m] = {};
      if (!monthlySpending[m][t.category]) monthlySpending[m][t.category] = 0;
      monthlySpending[m][t.category] += Math.abs(Number(t.amount));
    }

    const monthlyBudgetCompliance: Record<string, { onBudget: number; total: number; allOnBudget: boolean }> = {};
    for (const [month, catSpending] of Object.entries(monthlySpending)) {
      let onBudget = 0;
      let total = 0;
      for (const [cat, spent] of Object.entries(catSpending)) {
        if (budgetMap[cat] !== undefined) {
          total++;
          if (spent <= budgetMap[cat]) onBudget++;
        }
      }
      monthlyBudgetCompliance[month] = {
        onBudget,
        total,
        allOnBudget: total > 0 && onBudget === total,
      };
    }

    // Consecutive budget months (counting backwards from current)
    let consecutiveBudgetMonths = 0;
    const checkDate = new Date();
    for (let i = 0; i < 60; i++) {
      const m = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}`;
      const c = monthlyBudgetCompliance[m];
      if (c && c.allOnBudget) {
        consecutiveBudgetMonths++;
      } else if (i > 0) {
        break; // Allow current month to not be complete yet
      }
      checkDate.setMonth(checkDate.getMonth() - 1);
    }

    // Streak (consecutive days with transactions)
    const dateSet = new Set(txnDates.map(t => new Date(t.date).toISOString().slice(0, 10)));
    let streak = 0;
    const streakDate = new Date();
    for (let i = 0; i < 400; i++) {
      const ds = streakDate.toISOString().slice(0, 10);
      if (dateSet.has(ds)) {
        streak++;
      } else if (i > 0) {
        break;
      }
      streakDate.setDate(streakDate.getDate() - 1);
    }

    // Unique months tracked
    const monthSet = new Set(txnDates.map(t => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }));
    const totalMonthsTracked = monthSet.size;

    // Account age
    const accountAgeDays = user ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // ─── Build context ───
    const ctx: AchievementContext = {
      totalTxns,
      totalIncomeTxns,
      totalExpenseTxns,
      uniqueCategories,
      uniqueAccounts,
      oldestTxnDays,
      totalGoals,
      completedGoals,
      totalSaved,
      largestGoal,
      totalDebts,
      paidOffDebts,
      totalDebtBalance,
      totalDebtOriginal,
      debtPayoffPercent,
      isDebtFree,
      hasDebts,
      budgetCategories: budgets.length,
      monthlyBudgetCompliance,
      consecutiveBudgetMonths,
      monthlyIncome,
      monthlyExpenses,
      netSavings,
      savingsRate,
      totalAssets,
      netWorth,
      assetTypes,
      streak,
      longestStreak: streak,
      accountAgeDays,
      totalMonthsTracked,
    };

    // ─── Evaluate ───
    const unlockedSet = evaluateAchievements(ctx);

    return NextResponse.json({
      total: ALL_ACHIEVEMENTS.length,
      unlocked: unlockedSet.size,
      unlockedKeys: Array.from(unlockedSet),
      context: ctx,
    });
  } catch (error) {
    console.error('GET /api/achievements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
