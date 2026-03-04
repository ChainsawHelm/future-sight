import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { debtUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const existing = await prisma.debt.findFirst({
      where: { id: params.id, userId: result.userId },
    });
    if (!existing) return NextResponse.json({ error: 'Debt not found' }, { status: 404 });

    const body = await req.json();
    const data = debtUpdateSchema.parse(body);

    const debt = await prisma.debt.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({
      debt: {
        ...debt,
        balance: Number(debt.balance),
        originalBalance: Number(debt.originalBalance),
        interestRate: Number(debt.interestRate),
        minimumPayment: Number(debt.minimumPayment),
        extraPayment: Number(debt.extraPayment),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const existing = await prisma.debt.findFirst({
    where: { id: params.id, userId: result.userId },
  });
  if (!existing) return NextResponse.json({ error: 'Debt not found' }, { status: 404 });

  await prisma.debt.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
