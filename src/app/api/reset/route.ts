import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  // Delete in dependency order to avoid FK conflicts:
  // 1. Transactions (references ImportRecords)
  // 2. ImportRecords
  // 3. PlaidItems (cascades to PlaidAccounts)
  // 4. NetWorthSnapshots (stale without transaction history)

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
}
