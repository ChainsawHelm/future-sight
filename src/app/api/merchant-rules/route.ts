import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { merchantRuleSchema, merchantRuleBulkSchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET() {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  const rules = await prisma.merchantRule.findMany({
    where: { userId: result.userId },
    orderBy: { merchant: 'asc' },
  });

  // Return as object map for frontend compat: { "MERCHANT": "Category" }
  const rulesMap: Record<string, string> = {};
  for (const r of rules) rulesMap[r.merchant] = r.category;

  return NextResponse.json({ rules: rulesMap, rulesList: rules });
}

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const body = await req.json();

    // Support both single rule and bulk
    if (body.rules) {
      const data = merchantRuleBulkSchema.parse(body);

      const upserts = data.rules.map((r) =>
        prisma.merchantRule.upsert({
          where: {
            userId_merchant: { userId: result.userId, merchant: r.merchant },
          },
          create: { userId: result.userId, merchant: r.merchant, category: r.category },
          update: { category: r.category },
        })
      );

      await prisma.$transaction(upserts);
      return NextResponse.json({ updated: data.rules.length }, { status: 201 });
    } else {
      const data = merchantRuleSchema.parse(body);

      const rule = await prisma.merchantRule.upsert({
        where: {
          userId_merchant: { userId: result.userId, merchant: data.merchant },
        },
        create: { userId: result.userId, ...data },
        update: { category: data.category },
      });

      return NextResponse.json({ rule }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('POST /api/merchant-rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const result = await requireAuth();
  if ('error' in result) return result.error;

  try {
    const { merchant } = await req.json();
    if (!merchant) {
      return NextResponse.json({ error: 'merchant is required' }, { status: 400 });
    }

    await prisma.merchantRule.deleteMany({
      where: { userId: result.userId, merchant },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/merchant-rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
