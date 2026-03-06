import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

const exchangeSchema = z.object({
  public_token: z.string().min(1).max(500),
  metadata: z.object({
    institution: z.object({
      institution_id: z.string().optional(),
      name: z.string().optional(),
    }).optional(),
  }).optional(),
});

export async function POST(req: any) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit Plaid operations
  const rl = rateLimit(session.user.id, 'api:plaid');
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  try {
    const body = await req.json();
    const { public_token, metadata } = exchangeSchema.parse(body);

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    // Encrypt access token before storing
    const encryptedToken = process.env.ENCRYPTION_KEY
      ? encrypt(access_token)
      : access_token;

    await prisma.plaidItem.create({
      data: {
        userId: session.user.id,
        itemId: item_id,
        accessToken: encryptedToken,
        institutionId: metadata?.institution?.institution_id || null,
        institutionName: metadata?.institution?.name || null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    console.error('Plaid exchange error:', err.message);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
