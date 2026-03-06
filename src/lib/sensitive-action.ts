import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Require a fresh session for sensitive operations (Plaid connect, account delete).
 * The JWT must have been refreshed within the last 5 minutes (i.e., user was recently active).
 * If the session is stale, returns a 403 requiring re-authentication.
 */
const MAX_STALE_MS = 5 * 60 * 1000; // 5 minutes

export async function requireFreshSession(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const lastActivity = (session as any).lastActivity;
  if (lastActivity && Date.now() - lastActivity > MAX_STALE_MS) {
    return {
      error: NextResponse.json(
        { error: 'Session too stale for sensitive operations. Please refresh the page and try again.' },
        { status: 403 }
      ),
    };
  }

  return { userId: session.user.id };
}
