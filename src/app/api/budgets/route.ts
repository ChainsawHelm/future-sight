import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { budgetCreateSchema, budgetBulkSchema, budgetUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeBudget(b: any) {
  return { ...b, monthlyLimit: Number(b.monthlyLimit) };
}

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const budgets = await prisma.budget.findMany({
    where: { userId: result.userId },
    orderBy: { category: 'asc' },
  });

  // Also return as map for frontend compat
  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = Number(b.monthlyLimit);

  return NextResponse.json({
    budgets: budgets.map(serializeBudget),
    budgetMap,
  });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();

    // Support bulk upsert
    if (body.budgets) {
      const data = budgetBulkSchema.parse(body);

      const upserts = data.budgets.map((b) =>
        prisma.budget.upsert({
          where: { userId_category: { userId: result.userId, category: b.category } },
          create: { userId: result.userId, ...b },
          update: { monthlyLimit: b.monthlyLimit, rollover: b.rollover },
        })
      );

      await prisma.$transaction(upserts);
      return NextResponse.json({ updated: data.budgets.length }, { status: 201 });
    }

    // Single create/upsert
    const data = budgetCreateSchema.parse(body);
    const budget = await prisma.budget.upsert({
      where: { userId_category: { userId: result.userId, category: data.category } },
      create: { userId: result.userId, ...data },
      update: { monthlyLimit: data.monthlyLimit, rollover: data.rollover },
    });

    return NextResponse.json({ budget: serializeBudget(budget) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const { category } = await req.json();
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });

    await prisma.budget.deleteMany({
      where: { userId: result.userId, category },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
