import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function POST(req: any) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { public_token, metadata } = await req.json();
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;
    await prisma.plaidItem.create({
      data: {
        userId: session.user.id,
        itemId: item_id,
        accessToken: access_token,
        institutionId: metadata?.institution?.institution_id || null,
        institutionName: metadata?.institution?.name || null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Plaid exchange error:', err?.response?.data || err.message);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
