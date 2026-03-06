import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { subscriptionUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const existing = await prisma.subscription.findFirst({
      where: { id: params.id, userId: result.userId },
    });
    if (!existing) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

    const body = await req.json();
    const data = subscriptionUpdateSchema.parse(body);

    const updateData: any = { ...data };
    if (data.nextBillDate) updateData.nextBillDate = new Date(data.nextBillDate);

    const sub = await prisma.subscription.update({ where: { id: params.id }, data: updateData });

    return NextResponse.json({
      subscription: { ...sub, amount: Number(sub.amount), nextBillDate: sub.nextBillDate?.toISOString().slice(0, 10) ?? null },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  const existing = await prisma.subscription.findFirst({
    where: { id: params.id, userId: result.userId },
  });
  if (!existing) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

  await prisma.subscription.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
