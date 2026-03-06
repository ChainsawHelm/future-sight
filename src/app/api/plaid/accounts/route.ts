import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { decrypt } from '@/lib/encryption';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const items = await prisma.plaidItem.findMany({
    where: { userId },
    include: {
      accounts: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          accountId: true,
          name: true,
          officialName: true,
          type: true,
          subtype: true,
          currentBalance: true,
          availableBalance: true,
          mask: true,
          isoCurrencyCode: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const institutions = items.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    isActive: item.isActive,
    lastSynced: item.lastSynced,
    createdAt: item.createdAt,
    accounts: item.accounts.map((a) => ({
      ...a,
      currentBalance: a.currentBalance !== null ? Number(a.currentBalance) : null,
      availableBalance: a.availableBalance !== null ? Number(a.availableBalance) : null,
    })),
  }));

  return NextResponse.json({ institutions });
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

  try { await plaidClient.itemRemove({ access_token: decrypt(item.accessToken) }); } catch {}
  await prisma.plaidItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
