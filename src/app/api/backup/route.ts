import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { sanitizeString } from '@/lib/sanitize';
import { audit } from '@/lib/audit';

/** Parse a number safely — returns 0 instead of NaN */
function safeNumber(val: any): number {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

/** Parse a date safely — returns current date if invalid */
function safeDate(val: any): Date {
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

// GET /api/backup — export all user data as JSON
export async function GET() {
  const result = await requireAuthWithLimit('api:backup');
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

  const data = {
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
  };

  // Create checksum of the data for integrity verification on restore
  const dataStr = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(dataStr).digest('hex');

  const backup = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    checksum,
    data,
  };

  await audit('export_backup', userId);
  return NextResponse.json(backup);
}

// POST /api/backup — restore from backup JSON
export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:backup');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const backup = await req.json();

    if (!backup.data || !backup.version) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    // Verify checksum if present (v2.0.0+ backups)
    if (backup.checksum) {
      const dataStr = JSON.stringify(backup.data);
      const expected = crypto.createHash('sha256').update(dataStr).digest('hex');
      if (expected !== backup.checksum) {
        return NextResponse.json({ error: 'Backup integrity check failed — data may be corrupted' }, { status: 400 });
      }
    }

    const d = backup.data;
    const counts: Record<string, number> = {};

    // Restore in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Transactions — whitelist + sanitize + validate
      if (d.transactions?.length) {
        await tx.transaction.deleteMany({ where: { userId } });
        await tx.transaction.createMany({
          data: d.transactions.map((t: any) => ({
            userId,
            date: safeDate(t.date),
            description: sanitizeString(String(t.description || '')),
            originalDescription: t.originalDescription ? sanitizeString(String(t.originalDescription)) : null,
            amount: safeNumber(t.amount),
            category: sanitizeString(String(t.category || 'Uncategorized')),
            account: sanitizeString(String(t.account || 'Default')),
            autoMatched: Boolean(t.autoMatched),
            flagged: Boolean(t.flagged),
            transferPairId: t.transferPairId ? String(t.transferPairId) : null,
            returnPairId: t.returnPairId ? String(t.returnPairId) : null,
            note: t.note ? sanitizeString(String(t.note)) : null,
          })),
        });
        counts.transactions = d.transactions.length;
      }

      // Categories — whitelist + sanitize
      if (d.categories?.length) {
        await tx.category.deleteMany({ where: { userId } });
        await tx.category.createMany({
          data: d.categories.map((c: any) => ({
            userId,
            name: sanitizeString(String(c.name)),
            type: ['income', 'expense', 'system'].includes(c.type) ? c.type : 'expense',
            color: c.color ? String(c.color).slice(0, 20) : null,
            sortOrder: safeNumber(c.sortOrder),
          })),
        });
        counts.categories = d.categories.length;
      }

      // Budgets — validate numbers
      if (d.budgets?.length) {
        await tx.budget.deleteMany({ where: { userId } });
        await tx.budget.createMany({
          data: d.budgets.map((b: any) => ({
            userId,
            category: sanitizeString(String(b.category || '')),
            monthlyLimit: safeNumber(b.monthlyLimit),
            rollover: b.rollover ?? false,
          })),
          skipDuplicates: true,
        });
        counts.budgets = d.budgets.length;
      }

      // Settings — whitelist fields
      if (d.settings) {
        const safeSettings: any = {};
        if (typeof d.settings.darkMode === 'boolean') safeSettings.darkMode = d.settings.darkMode;
        if (typeof d.settings.currency === 'string') safeSettings.currency = d.settings.currency;
        if (typeof d.settings.locale === 'string') safeSettings.locale = d.settings.locale;
        if (typeof d.settings.dashPeriod === 'string') safeSettings.dashPeriod = d.settings.dashPeriod;
        if (typeof d.settings.sidebarOpen === 'boolean') safeSettings.sidebarOpen = d.settings.sidebarOpen;
        if (typeof d.settings.budgetRollover === 'boolean') safeSettings.budgetRollover = d.settings.budgetRollover;
        await tx.userSettings.upsert({
          where: { userId },
          create: { userId, ...safeSettings },
          update: safeSettings,
        });
        counts.settings = 1;
      }
    });

    await audit('restore_backup', userId, JSON.stringify(counts));
    return NextResponse.json({
      message: 'Backup restored successfully',
      counts,
    });
  } catch (error) {
    console.error('POST /api/backup error:', error);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}
