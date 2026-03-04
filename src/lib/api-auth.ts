import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

/**
 * Get the authenticated user's ID from the session.
 * Returns null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Require authentication for an API route.
 * Returns the userId or a 401 NextResponse.
 */
export async function requireAuth(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const userId = await getAuthUserId();
  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  return { userId };
}

/**
 * Require auth + rate limiting.
 * @param limitType - the rate limit bucket to use
 */
export async function requireAuthWithLimit(
  limitType: 'api:read' | 'api:write' | 'api:bulk' | 'api:backup' = 'api:read'
): Promise<{ userId: string } | { error: NextResponse }> {
  const userId = await getAuthUserId();
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const result = rateLimit(userId, limitType);
  if (!result.allowed) {
    return {
      error: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(result),
        }
      ),
    };
  }

  return { userId };
}

/**
 * Rate limit by IP for unauthenticated routes (login/register).
 */
export function rateLimitByIp(
  req: NextRequest,
  limitType: 'auth:login' | 'auth:register'
): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  const result = rateLimit(ip, limitType);
  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(result) }
    );
  }
  return null;
}
