import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthWithLimit } from '@/lib/api-auth';

export async function GET() {
  const result = await requireAuthWithLimit('api:read');
  if ('error' in result) return result.error;
  const { userId } = result;

  const items = await prisma.waitListItem.findMany({
    where: { userId },
    orderBy: { addedAt: 'desc' },
  });

  return NextResponse.json({
    items: items.map(i => ({
      id: i.id,
      name: i.name,
      amount: Number(i.amount),
      category: i.category,
      url: i.url,
      addedAt: i.addedAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
      status: i.status,
      resolvedAt: i.resolvedAt?.toISOString() || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;

  const body = await req.json();
  const { name, amount, category, url } = body;

  if (!name || !amount) {
    return NextResponse.json({ error: 'Name and amount are required' }, { status: 400 });
  }

  const addedAt = new Date();
  const expiresAt = new Date(addedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const item = await prisma.waitListItem.create({
    data: { userId, name, amount, category: category || null, url: url || null, addedAt, expiresAt },
  });

  return NextResponse.json({
    item: {
      id: item.id,
      name: item.name,
      amount: Number(item.amount),
      category: item.category,
      url: item.url,
      addedAt: item.addedAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
      status: item.status,
      resolvedAt: null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;

  const body = await req.json();
  const { id, status } = body;

  if (!id || !['bought', 'skipped'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await prisma.waitListItem.updateMany({
    where: { id, userId },
    data: { status, resolvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const result = await requireAuthWithLimit('api:write');
  if ('error' in result) return result.error;
  const { userId } = result;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.waitListItem.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
