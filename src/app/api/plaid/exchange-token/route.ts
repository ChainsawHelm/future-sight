import { NextResponse } from 'next/server';
import { z } from 'zod';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { encrypt, isEncrypted } from '@/lib/encryption';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { requireFreshSession } from '@/lib/sensitive-action';
import { audit } from '@/lib/audit';

const exchangeSchema = z.object({
  public_token: z.string().min(1).max(500),
  metadata: z.object({
    institution: z.object({
      institution_id: z.string().max(100).optional(),
      name: z.string().max(200).optional(),
    }).optional(),
  }).optional(),
});

export async function POST(req: any) {
  // Require fresh session for bank connections (sensitive operation)
  const authResult = await requireFreshSession();
  if ('error' in authResult) return authResult.error;
  const { userId } = authResult;

  // Rate limit Plaid operations
  const rl = rateLimit(userId, 'api:plaid');
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

    // Encrypt access token before storing — ENCRYPTION_KEY is required
    if (!process.env.ENCRYPTION_KEY) {
      console.error('ENCRYPTION_KEY is not set — refusing to store Plaid token in plaintext');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const encryptedToken = encrypt(access_token);

    // Verify encryption actually produced the expected format
    if (!isEncrypted(encryptedToken)) {
      console.error('[SECURITY] Encryption produced unexpected format — refusing to store');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    await prisma.plaidItem.create({
      data: {
        userId,
        itemId: item_id,
        accessToken: encryptedToken,
        institutionId: metadata?.institution?.institution_id || null,
        institutionName: metadata?.institution?.name || null,
      },
    });
    await audit('plaid_connect', userId, metadata?.institution?.name || 'unknown');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    // Don't log full error — could contain token data
    console.error('Plaid exchange error:', err.name || 'unknown');
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
