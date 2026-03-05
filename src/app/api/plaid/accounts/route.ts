import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const items = await prisma.plaidItem.findMany({
    where: { userId: session.user.id },
    select: { id: true, institutionName: true, isActive: true, lastSynced: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ accounts: items });
}

export async function DELETE(req: any) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const item = await prisma.plaidItem.findFirst({ where: { id, userId: session.user.id } });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try { await plaidClient.itemRemove({ access_token: item.accessToken }); } catch {}
  await prisma.plaidItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
