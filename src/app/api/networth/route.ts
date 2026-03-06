import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { snapshotCreateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeSnapshot(s: any) {
  return {
    ...s,
    assets: Number(s.assets),
    liabilities: Number(s.liabilities),
    netWorth: Number(s.netWorth),
    date: s.date?.toISOString?.().slice(0, 10) ?? s.date,
  };
}

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { userId: result.userId },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ snapshots: snapshots.map(serializeSnapshot) });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = snapshotCreateSchema.parse(body);

    const snapshot = await prisma.netWorthSnapshot.create({
      data: {
        userId: result.userId,
        date: new Date(data.date),
        assets: data.assets,
        liabilities: data.liabilities,
        netWorth: data.netWorth,
        breakdown: data.breakdown,
      },
    });

    return NextResponse.json({ snapshot: serializeSnapshot(snapshot) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
