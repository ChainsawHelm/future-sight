import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(session.user.id, 'api:plaid');
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: 'Future Sight',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error('Plaid link token error:', err.message);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
