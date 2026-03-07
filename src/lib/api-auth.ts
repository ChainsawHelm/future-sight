import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
 * Verify the X-Requested-With header for CSRF protection on state-changing requests.
 * Custom headers cannot be set by cross-origin HTML forms, so this blocks CSRF attacks.
 */
function verifyCsrfHeader(): boolean {
  try {
    const hdrs = headers();
    const value = hdrs.get('x-requested-with');
    if (value !== 'FutureSight') {
      console.warn(`[csrf] Header check failed. Got: "${value}" (expected "FutureSight")`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[csrf] headers() threw:', err);
    return false;
  }
}

/**
 * Require auth + rate limiting.
 * For write operations, also verifies CSRF header.
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

  // Block access if account is scheduled for deletion
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { scheduledDeletion: true },
  });
  if (user?.scheduledDeletion) {
    return {
      error: NextResponse.json(
        { error: 'Account is scheduled for deletion. Cancel deletion to regain access.' },
        { status: 403 }
      ),
    };
  }

  // CSRF check on write operations (not reads — GETs don't change state)
  if (limitType !== 'api:read' && !verifyCsrfHeader()) {
    return {
      error: NextResponse.json({ error: 'Invalid request origin' }, { status: 403 }),
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
