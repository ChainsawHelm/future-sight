import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { sanitizeString } from '@/lib/sanitize';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;
  const { userId } = result;

  const status = req.nextUrl.searchParams.get('status') || undefined;

  const reports = await prisma.expenseReport.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: {
      items: {
        include: { transaction: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    reports: reports.map(r => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      items: r.items.map(i => ({
        ...i,
        transaction: {
          ...i.transaction,
          amount: Number(i.transaction.amount),
          date: i.transaction.date instanceof Date
            ? i.transaction.date.toISOString().slice(0, 10)
            : i.transaction.date,
        },
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const report = await prisma.expenseReport.create({
      data: {
        userId,
        title: sanitizeString(data.title),
        description: data.description ? sanitizeString(data.description) : null,
      },
    });

    return NextResponse.json({
      report: { ...report, totalAmount: Number(report.totalAmount) },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('POST /api/expense-reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
