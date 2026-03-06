import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { debtCreateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeDebt(d: any) {
  return {
    ...d,
    balance: Number(d.balance),
    originalBalance: Number(d.originalBalance),
    interestRate: Number(d.interestRate),
    minimumPayment: Number(d.minimumPayment),
    extraPayment: Number(d.extraPayment),
    sortOrder: d.sortOrder ?? 0,
  };
}

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const debts = await prisma.debt.findMany({
    where: { userId: result.userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ debts: debts.map(serializeDebt) });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = debtCreateSchema.parse(body);

    const debt = await prisma.debt.create({
      data: { userId: result.userId, ...data },
    });

    return NextResponse.json({ debt: serializeDebt(debt) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
