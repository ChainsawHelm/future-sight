import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

const deleteSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
});

export async function DELETE(req: NextRequest) {
  const result = await requireAuthWithLimit('api:backup');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'You must send { "confirmation": "DELETE MY ACCOUNT" } to proceed' },
        { status: 400 }
      );
    }

    // Log before deletion since the user record will be gone after
    await audit('delete_account', userId);

    // Delete everything in dependency order, then the user record itself
    await prisma.$transaction([
      prisma.achievement.deleteMany({ where: { userId } }),
      prisma.goalContribution.deleteMany({ where: { goal: { userId } } }),
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.importRecord.deleteMany({ where: { userId } }),
      prisma.plaidAccount.deleteMany({ where: { userId } }),
      prisma.plaidItem.deleteMany({ where: { userId } }),
      prisma.netWorthSnapshot.deleteMany({ where: { userId } }),
      prisma.savingsGoal.deleteMany({ where: { userId } }),
      prisma.debt.deleteMany({ where: { userId } }),
      prisma.asset.deleteMany({ where: { userId } }),
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.calendarEvent.deleteMany({ where: { userId } }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.merchantRule.deleteMany({ where: { userId } }),
      prisma.category.deleteMany({ where: { userId } }),
      prisma.userSettings.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Account deletion error:', (error as Error).message);
    return NextResponse.json({ error: 'Account deletion failed' }, { status: 500 });
  }
}
