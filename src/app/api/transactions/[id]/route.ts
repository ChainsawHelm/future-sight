import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { validateId } from '@/lib/validate-id';
import { transactionUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const id = validateId(params.id);
  if (id instanceof NextResponse) return id;

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: result.userId },
  });

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  return NextResponse.json({
    transaction: {
      ...transaction,
      amount: Number(transaction.amount),
      date: transaction.date.toISOString().slice(0, 10),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = transactionUpdateSchema.parse(body);

    const id = validateId(params.id);
    if (id instanceof NextResponse) return id;

    // Verify ownership
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: result.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);

    // Preserve originalDescription on first rename
    if (data.description && !existing.originalDescription) {
      updateData.originalDescription = existing.description;
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      transaction: {
        ...transaction,
        amount: Number(transaction.amount),
        date: transaction.date.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('PATCH /api/transactions/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  const id = validateId(params.id);
  if (id instanceof NextResponse) return id;

  const existing = await prisma.transaction.findFirst({
    where: { id, userId: result.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
