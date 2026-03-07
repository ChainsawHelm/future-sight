import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { sanitizeString } from '@/lib/sanitize';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;
  const { userId } = result;
  const { id } = await params;

  const report = await prisma.expenseReport.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: { transaction: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    report: {
      ...report,
      totalAmount: Number(report.totalAmount),
      items: report.items.map(i => ({
        ...i,
        transaction: {
          ...i.transaction,
          amount: Number(i.transaction.amount),
          date: i.transaction.date instanceof Date
            ? i.transaction.date.toISOString().slice(0, 10)
            : i.transaction.date,
        },
      })),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;
  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.expenseReport.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (data.title) updateData.title = sanitizeString(data.title);
    if (data.description !== undefined) updateData.description = data.description ? sanitizeString(data.description) : null;
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'submitted') updateData.submittedAt = new Date();
    }

    const report = await prisma.expenseReport.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      report: { ...report, totalAmount: Number(report.totalAmount) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('PATCH /api/expense-reports/[id] error:', error);
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

  const existing = await prisma.expenseReport.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.expenseReport.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
