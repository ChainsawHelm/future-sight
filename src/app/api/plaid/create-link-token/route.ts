import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { plaidClient } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';

export async function POST(req: any) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: token.id as string },
      client_name: 'Future Sight',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error('Plaid link token error:', err?.response?.data || err.message);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
