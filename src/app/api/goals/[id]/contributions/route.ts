import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { contributionCreateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    // Verify goal ownership
    const goal = await prisma.savingsGoal.findFirst({
      where: { id: params.id, userId: result.userId },
    });
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const body = await req.json();
    const data = contributionCreateSchema.parse(body);

    const contribution = await prisma.goalContribution.create({
      data: {
        goalId: params.id,
        amount: data.amount,
        note: data.note,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });

    return NextResponse.json({
      contribution: {
        ...contribution,
        amount: Number(contribution.amount),
        date: contribution.date.toISOString().slice(0, 10),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
