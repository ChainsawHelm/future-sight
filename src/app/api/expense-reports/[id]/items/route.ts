import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { sanitizeString } from '@/lib/sanitize';
import { z } from 'zod';

const addItemsSchema = z.object({
  transactionIds: z.array(z.string()).min(1).max(500),
  note: z.string().max(500).optional(),
});

const removeItemsSchema = z.object({
  transactionIds: z.array(z.string()).min(1).max(500),
});

async function recalcTotal(reportId: string) {
  const items = await prisma.expenseReportItem.findMany({
    where: { expenseReportId: reportId },
    include: { transaction: { select: { amount: true } } },
  });
  const total = items.reduce((sum, i) => sum + Math.abs(Number(i.transaction.amount)), 0);
  await prisma.expenseReport.update({
    where: { id: reportId },
    data: { totalAmount: total },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;
  const { id } = await params;

  try {
    const body = await req.json();
    const data = addItemsSchema.parse(body);

    const report = await prisma.expenseReport.findFirst({
      where: { id, userId },
    });
    if (!report) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify all transactions belong to the user
    const txns = await prisma.transaction.findMany({
      where: { id: { in: data.transactionIds }, userId },
      select: { id: true },
    });
    const validIds = new Set(txns.map(t => t.id));

    // Create items, skipping duplicates
    const existing = await prisma.expenseReportItem.findMany({
      where: { expenseReportId: id, transactionId: { in: data.transactionIds } },
      select: { transactionId: true },
    });
    const existingIds = new Set(existing.map(e => e.transactionId));

    const toCreate = data.transactionIds
      .filter(tid => validIds.has(tid) && !existingIds.has(tid))
      .map(tid => ({
        expenseReportId: id,
        transactionId: tid,
        note: data.note ? sanitizeString(data.note) : null,
      }));

    if (toCreate.length > 0) {
      await prisma.expenseReportItem.createMany({ data: toCreate });
    }

    await recalcTotal(id);

    return NextResponse.json({ added: toCreate.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('POST /api/expense-reports/[id]/items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;
  const { id } = await params;

  try {
    const body = await req.json();
    const data = removeItemsSchema.parse(body);

    const report = await prisma.expenseReport.findFirst({
      where: { id, userId },
    });
    if (!report) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.expenseReportItem.deleteMany({
      where: {
        expenseReportId: id,
        transactionId: { in: data.transactionIds },
      },
    });

    await recalcTotal(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('DELETE /api/expense-reports/[id]/items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
