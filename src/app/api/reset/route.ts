import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const resetSchema = z.object({
  confirmation: z.literal('DELETE ALL MY DATA'),
});

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:backup');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'You must send { "confirmation": "DELETE ALL MY DATA" } to proceed' },
        { status: 400 }
      );
    }

    // Delete in dependency order to avoid FK conflicts
    const [txnCount, importCount, plaidCount, snapshotCount] = await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.importRecord.deleteMany({ where: { userId } }),
      prisma.plaidItem.deleteMany({ where: { userId } }),
      prisma.netWorthSnapshot.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({
      deleted: {
        transactions: txnCount.count,
        importRecords: importCount.count,
        plaidConnections: plaidCount.count,
        netWorthSnapshots: snapshotCount.count,
      },
    });
  } catch (error) {
    console.error('Reset error:', (error as Error).message);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
