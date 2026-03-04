import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const records = await prisma.importRecord.findMany({
    where: { userId: result.userId },
    orderBy: { importedAt: 'desc' },
    include: { _count: { select: { transactions: true } } },
  });

  return NextResponse.json({
    imports: records.map((r) => ({
      ...r,
      transactionCount: r._count.transactions,
      _count: undefined,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify ownership
    const record = await prisma.importRecord.findFirst({
      where: { id, userId: result.userId },
    });
    if (!record) {
      return NextResponse.json({ error: 'Import record not found' }, { status: 404 });
    }

    // Delete all transactions from this import, then the record
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { importRecordId: id, userId: result.userId } }),
      prisma.importRecord.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
