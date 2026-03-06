import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';
import { assetUpdateSchema } from '@/lib/validations';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  try {
    const existing = await prisma.asset.findFirst({
      where: { id: params.id, userId: result.userId },
    });
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const body = await req.json();
    const data = assetUpdateSchema.parse(body);

    const asset = await prisma.asset.update({ where: { id: params.id }, data });

    return NextResponse.json({ asset: { ...asset, value: Number(asset.value) } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;

  const existing = await prisma.asset.findFirst({
    where: { id: params.id, userId: result.userId },
  });
  if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  await prisma.asset.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
