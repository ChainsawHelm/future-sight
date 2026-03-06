import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory IP rate limiter for middleware (edge-compatible)
const ipWindows = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT = 300;
const IP_WINDOW_MS = 60_000;
const AUTH_LIMIT = 20;
const AUTH_WINDOW_MS = 300_000;

// Cleanup stale entries every 2 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of ipWindows) {
      if (w.resetAt < now) ipWindows.delete(key);
    }
  }, 120_000);
}

function checkIpLimit(ip: string, prefix: string, limit: number, windowMs: number): boolean {
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const existing = ipWindows.get(key);

  if (!existing || existing.resetAt < now) {
    ipWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) return false;
  existing.count++;
  return true;
}

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  // Stricter limit on auth-related routes
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
    || req.nextUrl.pathname === '/login';

  if (isAuthRoute) {
    if (!checkIpLimit(ip, 'auth', AUTH_LIMIT, AUTH_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        { status: 429 }
      );
    }
  }

  // Global IP rate limit on all API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    if (!checkIpLimit(ip, 'global', IP_LIMIT, IP_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
