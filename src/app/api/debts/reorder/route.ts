import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export async function PATCH(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    // Verify all debts belong to this user
    const debts = await prisma.debt.findMany({
      where: { userId: result.userId, id: { in: ids } },
      select: { id: true },
    });
    if (debts.length !== ids.length) {
      return NextResponse.json({ error: 'One or more debts not found' }, { status: 404 });
    }

    // Update sortOrder for each debt
    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.debt.update({ where: { id }, data: { sortOrder: index } })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
