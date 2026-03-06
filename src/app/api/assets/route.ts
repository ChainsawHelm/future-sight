import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { assetCreateSchema } from '@/lib/validations';
import { z } from 'zod';

function serializeAsset(a: any) {
  return { ...a, value: Number(a.value) };
}

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;

  const assets = await prisma.asset.findMany({
    where: { userId: result.userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ assets: assets.map(serializeAsset) });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const body = await req.json();
    const data = assetCreateSchema.parse(body);

    const asset = await prisma.asset.create({
      data: { userId: result.userId, ...data },
    });

    return NextResponse.json({ asset: serializeAsset(asset) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
