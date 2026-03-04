import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function POST(req: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { public_token, metadata } = await req.json();
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;
    const institutionId = metadata?.institution?.institution_id || null;
    const institutionName = metadata?.institution?.name || null;
    await prisma.plaidItem.create({
      data: {
        userId: token.id as string,
        itemId: item_id,
        accessToken: access_token,
        institutionId,
        institutionName,
      },
    });
    return NextResponse.json({ success: true, institutionName });
  } catch (err: any) {
    console.error('Plaid exchange error:', err?.response?.data || err.message);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
