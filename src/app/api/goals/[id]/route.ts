import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { goalUpdateSchema, contributionCreateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params {
  params: { id: string };
}

function serialize(g: any) {
  return {
    ...g,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    deadline: g.deadline?.toISOString?.().slice(0, 10) ?? g.deadline,
    contributions: g.contributions?.map((c: any) => ({
      ...c,
      amount: Number(c.amount),
      date: c.date?.toISOString?.().slice(0, 10) ?? c.date,
    })),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const goal = await prisma.savingsGoal.findFirst({
    where: { id: params.id, userId: result.userId },
    include: { contributions: { orderBy: { date: 'desc' } } },
  });

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  return NextResponse.json({ goal: serialize(goal) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const existing = await prisma.savingsGoal.findFirst({
      where: { id: params.id, userId: result.userId },
    });
    if (!existing) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const body = await req.json();
    const data = goalUpdateSchema.parse(body);

    const updateData: any = { ...data };
    if (data.deadline) updateData.deadline = new Date(data.deadline);
    if (data.deadline === null) updateData.deadline = null;

    const goal = await prisma.savingsGoal.update({
      where: { id: params.id },
      data: updateData,
      include: { contributions: { orderBy: { date: 'desc' } } },
    });

    return NextResponse.json({ goal: serialize(goal) });
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

  const existing = await prisma.savingsGoal.findFirst({
    where: { id: params.id, userId: result.userId },
  });
  if (!existing) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  await prisma.savingsGoal.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
