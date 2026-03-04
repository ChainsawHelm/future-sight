import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

// GET /api/backup — export all user data as JSON
export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result;

  const [
    transactions,
    categories,
    merchantRules,
    importHistory,
    savingsGoals,
    debts,
    assets,
    netWorthSnapshots,
    budgets,
    calendarEvents,
    subscriptions,
    achievements,
    settings,
  ] = await Promise.all([
    prisma.transaction.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.merchantRule.findMany({ where: { userId } }),
    prisma.importRecord.findMany({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId }, include: { contributions: true } }),
    prisma.debt.findMany({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.netWorthSnapshot.findMany({ where: { userId } }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.calendarEvent.findMany({ where: { userId } }),
    prisma.subscription.findMany({ where: { userId } }),
    prisma.achievement.findMany({ where: { userId } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  const backup = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    data: {
      transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount), date: t.date.toISOString().slice(0, 10) })),
      categories,
      merchantRules,
      importHistory,
      savingsGoals: savingsGoals.map((g) => ({
        ...g,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        contributions: g.contributions.map((c) => ({ ...c, amount: Number(c.amount) })),
      })),
      debts: debts.map((d) => ({
        ...d,
        balance: Number(d.balance),
        originalBalance: Number(d.originalBalance),
        interestRate: Number(d.interestRate),
        minimumPayment: Number(d.minimumPayment),
        extraPayment: Number(d.extraPayment),
      })),
      assets: assets.map((a) => ({ ...a, value: Number(a.value) })),
      netWorthSnapshots: netWorthSnapshots.map((s) => ({
        ...s,
        assets: Number(s.assets),
        liabilities: Number(s.liabilities),
        netWorth: Number(s.netWorth),
      })),
      budgets: budgets.map((b) => ({ ...b, monthlyLimit: Number(b.monthlyLimit) })),
      calendarEvents: calendarEvents.map((e) => ({ ...e, amount: e.amount ? Number(e.amount) : null })),
      subscriptions: subscriptions.map((s) => ({ ...s, amount: Number(s.amount) })),
      achievements,
      settings,
    },
  };

  return NextResponse.json(backup);
}

// POST /api/backup — restore from backup JSON
export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const backup = await req.json();

    if (!backup.data || !backup.version) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    const d = backup.data;
    const counts: Record<string, number> = {};

    // Restore in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Transactions
      if (d.transactions?.length) {
        // Clear existing first
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.transaction.createMany({
          data: d.transactions.map((t: any) => ({
            ...t,
            userId,
            date: new Date(t.date),
            id: undefined, // Let DB assign new IDs
            createdAt: undefined,
            updatedAt: undefined,
          })),
        });
        counts.transactions = d.transactions.length;
      }

      // Categories
      if (d.categories?.length) {
        await tx.category.deleteMany({ where: { userId } });
        await tx.category.createMany({
          data: d.categories.map((c: any) => ({
            ...c,
            userId,
            id: undefined,
          })),
        });
        counts.categories = d.categories.length;
      }

      // Budgets
      if (d.budgets?.length) {
        await tx.budget.deleteMany({ where: { userId } });
        await tx.budget.createMany({
          data: d.budgets.map((b: any) => ({
            userId,
            category: b.category,
            monthlyLimit: b.monthlyLimit,
            rollover: b.rollover ?? false,
          })),
          skipDuplicates: true,
        });
        counts.budgets = d.budgets.length;
      }

      // Settings
      if (d.settings) {
        const { id, userId: _, ...settingsData } = d.settings;
        await tx.userSettings.upsert({
          where: { userId },
          create: { userId, ...settingsData },
          update: settingsData,
        });
        counts.settings = 1;
      }
    });

    return NextResponse.json({
      message: 'Backup restored successfully',
      counts,
    });
  } catch (error) {
    console.error('POST /api/backup error:', error);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}
