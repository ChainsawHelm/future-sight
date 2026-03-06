/**
 * Simple in-memory rate limiter using sliding window.
 * For production with multiple instances, replace with Redis-backed limiter.
 */

interface RateWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateWindow>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (window.resetAt < now) windows.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in seconds */
  windowSecs: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  // API reads — generous
  'api:read': { maxRequests: 120, windowSecs: 60 },
  // API writes — moderate
  'api:write': { maxRequests: 60, windowSecs: 60 },
  // Bulk operations — tight
  'api:bulk': { maxRequests: 10, windowSecs: 60 },
  // Backup — very tight
  'api:backup': { maxRequests: 5, windowSecs: 300 },
  // Plaid operations — tight
  'api:plaid': { maxRequests: 10, windowSecs: 60 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limitType: keyof typeof LIMITS
): RateLimitResult {
  const config = LIMITS[limitType];
  if (!config) return { allowed: true, remaining: 999, resetAt: 0 };

  const windowKey = `${limitType}:${key}`;
  const now = Date.now();
  const existing = windows.get(windowKey);

  if (!existing || existing.resetAt < now) {
    // New window
    windows.set(windowKey, { count: 1, resetAt: now + config.windowSecs * 1000 });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowSecs * 1000 };
  }

  if (existing.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: config.maxRequests - existing.count, resetAt: existing.resetAt };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}
