import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { subscriptionCreateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeSub(s: any) {
  return {
    ...s,
    amount: Number(s.amount),
    nextBillDate: s.nextBillDate?.toISOString?.().slice(0, 10) ?? s.nextBillDate,
  };
}

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const subs = await prisma.subscription.findMany({
    where: { userId: result.userId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ subscriptions: subs.map(serializeSub) });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = subscriptionCreateSchema.parse(body);

    const sub = await prisma.subscription.create({
      data: {
        userId: result.userId,
        name: data.name,
        amount: data.amount,
        frequency: data.frequency,
        category: data.category,
        nextBillDate: data.nextBillDate ? new Date(data.nextBillDate) : null,
        isActive: data.isActive,
      },
    });

    return NextResponse.json({ subscription: serializeSub(sub) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
