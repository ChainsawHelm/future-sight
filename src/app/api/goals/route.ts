import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { goalCreateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeGoal(g: any) {
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

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: result.userId },
    include: { contributions: { orderBy: { date: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ goals: goals.map(serializeGoal) });
}

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = goalCreateSchema.parse(body);

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: result.userId,
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        deadline: data.deadline ? new Date(data.deadline) : null,
        linkedAccount: data.linkedAccount,
        icon: data.icon,
        color: data.color,
        priority: data.priority,
      },
      include: { contributions: true },
    });

    return NextResponse.json({ goal: serializeGoal(goal) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('POST /api/goals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
